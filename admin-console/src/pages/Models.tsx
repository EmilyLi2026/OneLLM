import { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, SelectProps,
  Tag, Space, Typography, message, Radio, Drawer, Descriptions, Card, Spin, InputNumber, Switch, Divider,
} from 'antd';
import {
  PlusOutlined, AppstoreOutlined, CompassOutlined, DeleteOutlined, EditOutlined,
  EyeOutlined, FilterOutlined, CloudDownloadOutlined, GlobalOutlined,
} from '@ant-design/icons';
import { modelsAPI } from '../api/client';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '可用' },
  beta: { color: 'blue', label: '测试' },
  deprecated: { color: 'orange', label: '已弃用' },
  coming_soon: { color: 'purple', label: '即将上线' },
};

const CAP_LABELS: Record<string, string> = {
  function_calling: 'FC',
  vision: 'Vision',
  code: 'Code',
};

export function ModelsPage() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0 });
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [seriesFilter, setSeriesFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const [providers, setProviders] = useState<any[]>([]);
  const [seriesList, setSeriesList] = useState<any[]>([]);

  // Modal for create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [form] = Form.useForm();

  // Drawer for discovery
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [discoveryModels, setDiscoveryModels] = useState<any[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryChineseOnly, setDiscoveryChineseOnly] = useState(true);
  const [discoveryMode, setDiscoveryMode] = useState<'new' | 'all'>('all');
  const [syncLoading, setSyncLoading] = useState(false);
  const [discoveryMeta, setDiscoveryMeta] = useState<{ source: string; count: number; new_count: number; chinese_only: boolean; mode: string } | null>(null);
  const [showNewOnly, setShowNewOnly] = useState(true);

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailModel, setDetailModel] = useState<any>(null);

  // ── Fetch ──
  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: pagination.page, limit: pagination.page_size };
      if (providerFilter) params.provider = providerFilter;
      if (seriesFilter) params.series = seriesFilter;
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;

      const { data } = await modelsAPI.list(params);
      setModels(data.data.models);
      setPagination(prev => ({ ...prev, total: data.data.pagination.total }));
    } catch { message.error('加载模型列表失败'); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.page_size, providerFilter, seriesFilter, statusFilter, search]);

  const fetchMeta = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([modelsAPI.providers(), modelsAPI.series()]);
      setProviders(pRes.data.data || []);
      setSeriesList(sRes.data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchModels(); }, [fetchModels]);

  // ── Handlers ──
  const handleCreate = async (values: any) => {
    setModalLoading(true);
    try {
      if (editingModel) {
        await modelsAPI.update(editingModel.id, values);
        message.success('模型更新成功');
      } else {
        await modelsAPI.create(values);
        message.success('模型创建成功');
      }
      setModalOpen(false);
      setEditingModel(null);
      form.resetFields();
      fetchModels();
    } catch (err: any) { message.error(err.response?.data?.message || '操作失败'); }
    finally { setModalLoading(false); }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除此模型？',
      content: '此操作不可撤销',
      onOk: async () => {
        try { await modelsAPI.delete(id); message.success('已删除'); fetchModels(); }
        catch { message.error('删除失败'); }
      },
    });
  };

  const openEdit = (model: any) => {
    setEditingModel(model);
    form.setFieldsValue(model);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingModel(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openDetail = (model: any) => {
    setDetailModel(model);
    setDetailOpen(true);
  };

  const fetchDiscovery = async () => {
    setDiscoveryLoading(true);
    try {
      const params: Record<string, any> = {
        chinese_only: discoveryChineseOnly ? 'true' : 'false',
        mode: discoveryMode,
      };
      if (discoveryMode === 'new') params.days = 60;
      const { data } = await modelsAPI.discovery(params);
      setDiscoveryModels(data.data.models || []);
      setDiscoveryMeta({
        source: data.data.source,
        count: data.data.count,
        new_count: data.data.new_count ?? 0,
        chinese_only: data.data.chinese_only,
        mode: data.data.mode,
      });
    } catch { message.error('获取模型发现失败'); }
    finally { setDiscoveryLoading(false); }
  };

  const openDiscovery = () => {
    setDiscoveryOpen(true);
    setShowNewOnly(true);
    if (discoveryModels.length === 0) fetchDiscovery();
  };

  const handleBatchSync = async () => {
    setSyncLoading(true);
    try {
      // Only send model_ids that are NOT already in the catalog (frontend pre-filter)
      const newModelIds = discoveryModels
        .filter((dm: any) => !dm.exists_in_catalog)
        .map((dm: any) => dm.id);

      const { data } = await modelsAPI.syncDiscovery({
        model_ids: newModelIds,
        chinese_only: discoveryChineseOnly,
        mode: discoveryMode,
        days: discoveryMode === 'new' ? 60 : 365,
      });
      message.success(data.data.message || `已同步 ${data.data.synced} 个模型`);
      fetchModels();
      // Mark newly synced models as existing so they disappear from "new only" view
      const syncedIds = new Set(newModelIds);
      setDiscoveryModels(prev =>
        prev.map(m => syncedIds.has(m.id) ? { ...m, exists_in_catalog: true } : m)
      );
      setDiscoveryMeta(prev => prev ? { ...prev, new_count: Math.max(0, (prev.new_count || 0) - data.data.synced) } : null);
    } catch (err: any) { message.error(err.response?.data?.message || '同步失败'); }
    finally { setSyncLoading(false); }
  };

  const addFromDiscovery = async (dm: any) => {
    try {
      await modelsAPI.create({
        name: dm.name,
        model_id: dm.id,
        provider_slug: dm.provider_slug,
        series_slug: dm.series_slug || undefined,
        description: dm.description,
        context_window: dm.context_length,
        max_output_tokens: dm.max_output_tokens,
        pricing_input_cents: String(Math.round(parseFloat(dm.pricing?.prompt || '0') * 1000000)),
        pricing_output_cents: String(Math.round(parseFloat(dm.pricing?.completion || '0') * 1000000)),
      });
      // Mark as existing locally so it disappears from discovery (if filtering new-only)
      setDiscoveryModels(prev =>
        prev.map(m => m.id === dm.id ? { ...m, exists_in_catalog: true } : m)
      );
      setDiscoveryMeta(prev => prev ? { ...prev, new_count: Math.max(0, (prev.new_count || 1) - 1) } : null);
      message.success('已添加到模型目录');
      fetchModels();
    } catch (err: any) { message.error(err.response?.data?.message || '添加失败'); }
  };

  // ── Chinese provider slugs (国产厂商) ──
  const CN_PROVIDER_SLUGS = new Set([
    'deepseek', 'alibaba', 'zhipu', 'moonshot', 'minimax',
    'baidu', 'bytedance', 'xunfei', 'lingyi', 'baichuan',
    'tencent', 'stepfun', 'siliconflow',
  ]);

  // ── Provider tabs ──
  const providerOptions: SelectProps['options'] = [
    { label: `全部 (${pagination.total})`, value: '' },
    ...providers
      .filter((p: any) => CN_PROVIDER_SLUGS.has(p.slug))
      .map((p: any) => ({ label: `${p.name_cn || p.name} (${p.model_count})`, value: p.slug })),
  ];

  const seriesOptions: SelectProps['options'] = [
    { label: '全部系列', value: '' },
    ...seriesList.map((s: any) => ({ label: s.name, value: s.slug })),
  ];

  const statusOptions: SelectProps['options'] = [
    { label: '全部状态', value: '' },
    { label: '可用', value: 'active' },
    { label: '测试', value: 'beta' },
    { label: '已弃用', value: 'deprecated' },
    { label: '即将上线', value: 'coming_soon' },
  ];

  // ── Columns ──
  const columns = [
    {
      title: '模型名称', dataIndex: 'name', key: 'name', width: 200,
      render: (t: string, r: any) => (
        <a onClick={() => openDetail(r)} style={{ fontWeight: 500 }}>{t}</a>
      ),
    },
    {
      title: 'API ID', dataIndex: 'model_id', key: 'model_id', width: 200,
      render: (t: string) => <code style={{ fontSize: 12 }}>{t}</code>,
    },
    {
      title: '厂商', key: 'provider', width: 110,
      render: (_: any, r: any) => (
        <Tag color="blue">{r.provider?.name_cn || r.provider?.name}</Tag>
      ),
    },
    {
      title: '系列', key: 'series', width: 90,
      render: (_: any, r: any) => r.series ? <Tag>{r.series.name}</Tag> : '-',
    },
    {
      title: '上下文', dataIndex: 'context_window', key: 'ctx', width: 80,
      render: (v: number) => v ? `${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}` : '-',
    },
    {
      title: '输入价格', key: 'p_in', width: 80,
      render: (_: any, r: any) => r.pricing?.input_cents > 0
        ? `¥${(r.pricing.input_cents / 100).toFixed(2)}/M` : '-',
    },
    {
      title: '输出价格', key: 'p_out', width: 80,
      render: (_: any, r: any) => r.pricing?.output_cents > 0
        ? `¥${(r.pricing.output_cents / 100).toFixed(2)}/M` : '-',
    },
    {
      title: '能力', key: 'caps', width: 100,
      render: (_: any, r: any) => (
        <Space size={4}>
          {r.capabilities?.function_calling && <Tag color="green">FC</Tag>}
          {r.capabilities?.vision && <Tag color="purple">Vision</Tag>}
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: string) => (
        <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.label || s}</Tag>
      ),
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)} />
          {r.is_editable && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} />
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <AppstoreOutlined style={{ marginRight: 8 }} />模型目录
        </Typography.Title>
        <Space>
          <Button icon={<CompassOutlined />} onClick={openDiscovery}>发现新模型</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加模型</Button>
        </Space>
      </div>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <FilterOutlined />
          <Select
            style={{ width: 160 }}
            value={providerFilter}
            onChange={(v) => { setProviderFilter(v); setPagination(p => ({ ...p, page: 1 })); }}
            options={providerOptions}
          />
          <Select
            style={{ width: 120 }}
            value={seriesFilter}
            onChange={(v) => { setSeriesFilter(v); setPagination(p => ({ ...p, page: 1 })); }}
            options={seriesOptions}
          />
          <Select
            style={{ width: 110 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPagination(p => ({ ...p, page: 1 })); }}
            options={statusOptions}
          />
          <Input.Search
            placeholder="搜索模型名称/ID"
            allowClear
            style={{ width: 250 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(v) => { setSearch(v); setPagination(p => ({ ...p, page: 1 })); }}
          />
        </Space>
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={models}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200, y: 'calc(100vh - 290px)' }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.page_size,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 个模型`,
          onChange: (page, pageSize) => setPagination({ page, page_size: pageSize, total: pagination.total }),
        }}
      />

      {/* Create/Edit Modal */}
      <Modal
        title={editingModel ? '编辑模型' : '添加模型'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingModel(null); }}
        onOk={() => form.submit()}
        confirmLoading={modalLoading}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="模型名称" rules={[{ required: true }]}>
            <Input placeholder="如：DeepSeek V4 Pro" />
          </Form.Item>
          <Form.Item name="model_id" label="API 调用 ID" rules={[{ required: true }]}
            extra="实际调用时使用的 model 字段值，如 deepseek-reasoner">
            <Input placeholder="deepseek-reasoner" />
          </Form.Item>
          <Space size={16}>
            <Form.Item name="provider_id" label="厂商">
              <Select style={{ width: 200 }} allowClear placeholder="选择厂商"
                options={providers.map((p: any) => ({ label: p.name_cn || p.name, value: p.id }))} />
            </Form.Item>
            <Form.Item name="series_id" label="系列">
              <Select style={{ width: 200 }} allowClear placeholder="选择系列"
                options={seriesList.map((s: any) => ({ label: s.name, value: s.id }))} />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="模型描述" />
          </Form.Item>
          <Space size={16}>
            <Form.Item name="context_window" label="上下文窗口">
              <InputNumber min={0} placeholder="128000" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="max_output_tokens" label="最大输出 Token">
              <InputNumber min={0} placeholder="16384" style={{ width: 150 }} />
            </Form.Item>
          </Space>
          <Space size={16}>
            <Form.Item name="pricing_input_cents" label="输入价格 (分/1M tokens)">
              <InputNumber min={0} placeholder="7" style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="pricing_output_cents" label="输出价格 (分/1M tokens)">
              <InputNumber min={0} placeholder="28" style={{ width: 180 }} />
            </Form.Item>
          </Space>
          <Form.Item name="status" label="状态" initialValue="active">
            <Radio.Group>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <Radio.Button key={k} value={k}>{v.label}</Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={detailModel?.name || '模型详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={480}
      >
        {detailModel && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="API ID"><code>{detailModel.model_id}</code></Descriptions.Item>
            <Descriptions.Item label="厂商">
              <Tag color="blue">{detailModel.provider?.name_cn || detailModel.provider?.name}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="系列">{detailModel.series?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="上下文窗口">
              {detailModel.context_window ? `${(detailModel.context_window / 1000).toFixed(0)}K` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="最大输出">
              {detailModel.max_output_tokens?.toLocaleString() || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="输入价格">
              ¥{(detailModel.pricing?.input_cents / 100).toFixed(2)}/1M tokens
            </Descriptions.Item>
            <Descriptions.Item label="输出价格">
              ¥{(detailModel.pricing?.output_cents / 100).toFixed(2)}/1M tokens
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_MAP[detailModel.status]?.color}>
                {STATUS_MAP[detailModel.status]?.label || detailModel.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="系统内置">
              {detailModel.is_system ? '是（只读）' : '否（可编辑）'}
            </Descriptions.Item>
            {detailModel.description && (
              <Descriptions.Item label="描述">{detailModel.description}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Drawer>

      {/* Discovery Drawer */}
      <Drawer
        title={
          <Space>
            <CompassOutlined />
            <span>发现新模型</span>
            {discoveryMeta && (
              <Tag color="blue">{discoveryMeta.count} 个</Tag>
            )}
          </Space>
        }
        open={discoveryOpen}
        onClose={() => setDiscoveryOpen(false)}
        width={650}
        extra={
          <Space>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>数据来源: OpenRouter 公开 API</Typography.Text>
          </Space>
        }
      >
        {/* Controls */}
        <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
          <Space wrap size={[16, 8]}>
            <Space size={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>范围:</Typography.Text>
              <Switch
                checkedChildren="仅国产"
                unCheckedChildren="全部厂商"
                checked={discoveryChineseOnly}
                onChange={(v) => setDiscoveryChineseOnly(v)}
                style={{ marginRight: 4 }}
              />
            </Space>
            <Divider type="vertical" />
            <Space size={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>模式:</Typography.Text>
              <Radio.Group
                value={discoveryMode}
                onChange={(e) => setDiscoveryMode(e.target.value)}
                size="small"
                optionType="button"
              >
                <Radio.Button value="new">最近上新</Radio.Button>
                <Radio.Button value="all">全量模型</Radio.Button>
              </Radio.Group>
            </Space>
            <Divider type="vertical" />
            <Button size="small" onClick={fetchDiscovery}>刷新</Button>
          </Space>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {discoveryChineseOnly
                ? '仅显示国产厂商: DeepSeek / 阿里 / 智谱 / 月之暗面 / MiniMax / 百度 / 字节 / 讯飞 / 零一 / 百川 / 腾讯 / 阶跃'
                : '显示全部厂商: 含 OpenAI / Anthropic / Google / Meta / Mistral / Cohere 等'
              }
            </Typography.Text>
          </div>
        </Card>

        {/* Batch actions */}
        {discoveryModels.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Space size={12}>
              <Typography.Text style={{ fontSize: 12 }}>
                共 <strong>{discoveryModels.length}</strong> 个
                {discoveryMeta?.new_count !== undefined && (
                  <span style={{ marginLeft: 6 }}>
                    · <Tag color="orange" style={{ marginLeft: 4 }}>{discoveryMeta.new_count} 个新模型</Tag>
                    · <Tag color="green" style={{ marginLeft: 2 }}>{discoveryModels.length - discoveryMeta.new_count} 个已收录</Tag>
                  </span>
                )}
              </Typography.Text>
              <Button
                size="small"
                type={showNewOnly ? 'primary' : 'default'}
                onClick={() => setShowNewOnly(!showNewOnly)}
              >
                {showNewOnly ? '仅显示新模型' : '显示全部'}
              </Button>
            </Space>
            <Button
              type="primary"
              size="small"
              icon={<CloudDownloadOutlined />}
              loading={syncLoading}
              onClick={handleBatchSync}
            >
              一键全部同步到目录
            </Button>
          </div>
        )}

        {discoveryLoading ? (
          <Spin tip="正在从 OpenRouter 获取最新模型..." style={{ display: 'block', margin: '60px auto' }} />
        ) : discoveryModels.length === 0 ? (
          <Typography.Text type="secondary">暂无匹配模型，调整筛选条件试试</Typography.Text>
        ) : (
          (() => {
            const displayModels = showNewOnly
              ? discoveryModels.filter((dm: any) => !dm.exists_in_catalog)
              : discoveryModels;
            if (displayModels.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Typography.Text type="secondary">🎉 所有模型已收录，无新模型</Typography.Text>
                  <br />
                  <Button type="link" onClick={() => setShowNewOnly(false)}>显示全部模型</Button>
                </div>
              );
            }
            return displayModels.map((dm: any) => (
            <Card
              key={dm.id}
              size="small"
              style={{ marginBottom: 12 }}
              title={
                <Space>
                  <Typography.Text strong>{dm.name}</Typography.Text>
                  <Tag color={dm.provider_region === 'cn' ? 'orange' : 'blue'}>
                    {dm.provider_region === 'cn' ? '🇨🇳 国产' : '🌐 海外'}
                  </Tag>
                  <Tag>{dm.provider_slug}</Tag>
                  {dm.exists_in_catalog ? (
                    <Tag color="green">已收录</Tag>
                  ) : (
                    <Tag color="orange">新模型</Tag>
                  )}
                </Space>
              }
              extra={
                dm.exists_in_catalog ? (
                  <Button size="small" disabled>已收录</Button>
                ) : (
                  <Button size="small" type="primary" onClick={() => addFromDiscovery(dm)}>添加到目录</Button>
                )
              }
            >
              <Space wrap size={[8, 4]} style={{ marginBottom: 8 }}>
                {dm.context_length > 0 && <Tag color="green">{`${(dm.context_length / 1000).toFixed(0)}K ctx`}</Tag>}
                {dm.max_output_tokens > 0 && <Tag>Max {dm.max_output_tokens.toLocaleString()} tokens</Tag>}
                {dm.modality && <Tag color="blue">{dm.modality}</Tag>}
                {dm.series_slug && <Tag color="purple">{dm.series_slug}</Tag>}
                {dm.pricing && (
                  <Tag color="gold">
                    ${dm.pricing.prompt}/$ {dm.pricing.completion} per 1M
                  </Tag>
                )}
                {dm.capabilities?.function_calling && <Tag color="cyan">FC</Tag>}
                {dm.capabilities?.vision && <Tag color="geekblue">Vision</Tag>}
              </Space>
              <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ fontSize: 13, marginBottom: 4 }}>
                {dm.description}
              </Typography.Paragraph>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                ID: <code>{dm.id}</code>
                {dm.created_at > 0 && ` · 上线: ${new Date(dm.created_at * 1000).toLocaleDateString('zh-CN')}`}
              </Typography.Text>
            </Card>
          ))
        })()
      )}
      </Drawer>
    </div>
  );
}
