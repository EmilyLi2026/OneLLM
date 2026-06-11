import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Typography, Space, Tag, Spin, Popconfirm } from 'antd';
import { PlusOutlined, CloudServerOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../api/client';

interface ProviderOption {
  value: string;   // gateway adapter name (= model_providers.slug)
  label: string;   // display label (name + name_cn)
  raw: { id: string; name: string; slug: string; name_cn: string | null; model_count: number };
}

export function ProvidersPage() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<any[]>([]);
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/providers');
      setProviders(data.data);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  /** Load available providers from the model catalog (database). Filter to 国产 only. */
  const fetchProviderOptions = async () => {
    try {
      const CN_SLUGS = new Set([
        'deepseek', 'alibaba', 'zhipu', 'moonshot', 'minimax',
        'baidu', 'bytedance', 'xunfei', 'lingyi', 'baichuan',
        'tencent', 'stepfun', 'siliconflow',
      ]);
      const { data } = await api.get('/models/providers');
      const options: ProviderOption[] = (data.data || [])
        .filter((p: any) => CN_SLUGS.has(p.slug))
        .map((p: any) => ({
          value: p.slug,
          label: p.name_cn ? `${p.name_cn} (${p.slug})` : `${p.name} (${p.slug})`,
          raw: p,
        }));
      options.sort((a, b) => a.label.localeCompare(b.label, 'zh'));
      setProviderOptions(options);
    } catch { /* non-critical */ }
  };

  useEffect(() => { fetchData(); fetchProviderOptions(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await api.post('/providers', values);
      message.success('Provider 凭证已添加（AES-256 加密存储）');
      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (err: any) { message.error(err.response?.data?.message || '添加失败'); }
  };

  const handleEdit = async (values: any) => {
    if (!editingProvider) return;
    try {
      await api.put(`/providers/${editingProvider.id}`, { api_key: values.api_key });
      message.success('API Key 已更新');
      setEditModalOpen(false);
      setEditingProvider(null);
      editForm.resetFields();
      fetchData();
    } catch (err: any) { message.error(err.response?.data?.message || '更新失败'); }
  };

  const handleDelete = async (record: any) => {
    try {
      const { data } = await api.delete(`/providers/${record.id}`);
      const removed = data.data?.bindings_removed || 0;
      message.success(removed > 0
        ? `已删除 ${record.provider_name}，同时移除了 ${removed} 个 Key 绑定`
        : `已删除 ${record.provider_name}`);
      fetchData();
    } catch (err: any) { message.error(err.response?.data?.message || '删除失败'); }
  };

  const columns = [
    { title: 'Provider', dataIndex: 'provider_name', key: 'name',
      render: (t: string) => {
        const opt = providerOptions.find(o => o.value === t);
        return (
          <Space>
            <CloudServerOutlined />
            <Tag color="blue">{opt?.label || t}</Tag>
          </Space>
        );
      } },
    { title: '创建时间', dataIndex: 'created_at', key: 'created',
      render: (d: string) => new Date(d).toLocaleString('zh-CN') },
    { title: '操作', key: 'action', render: (_: any, r: any) => (
      <Space>
        <Button size="small" onClick={() => { setEditingProvider(r); setEditModalOpen(true); }}>编辑</Button>
        <Popconfirm
          title="删除 Provider 凭证"
          description={`确定要删除 ${r.provider_name} 吗？相关的 Key 绑定也将被移除。`}
          onConfirm={() => handleDelete(r)}
          okText="确定删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <CloudServerOutlined style={{ marginRight: 8 }} />
          Provider 凭证
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>添加 Provider</Button>
      </div>

      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        这里存放上游模型厂商的真实 API Key。添加后，可在创建 API Key 时绑定到对应 Provider。
        所有 Key 使用 AES-256-CBC 加密存储。
      </Typography.Paragraph>

      <Table columns={columns} dataSource={providers} rowKey="id"
        scroll={{ y: 'calc(100vh - 260px)' }}
        locale={{ emptyText: '暂无 Provider，点击"添加 Provider"开始' }} />

      <Modal title="添加 Provider 凭证" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="provider_name" label="模型厂商" rules={[{ required: true, message: '请选择' }]}>
            <Select showSearch placeholder="选择模型厂商" options={providerOptions} loading={providerOptions.length === 0}
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              notFoundContent={providerOptions.length === 0 ? '加载中...' : '无匹配厂商'} />
          </Form.Item>
          <Form.Item name="api_key" label="API Key" rules={[{ required: true, message: '请输入真实 API Key' }]}
            extra="该 Key 将使用 AES-256 加密后存储">
            <Input.Password placeholder="sk-xxx..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`编辑 ${editingProvider?.provider_name || ''} API Key`} open={editModalOpen} onCancel={() => { setEditModalOpen(false); setEditingProvider(null); }} onOk={() => editForm.submit()}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="api_key" label="新的 API Key" rules={[{ required: true }]}
            extra="输入新的 Key 将替换旧的（AES-256 加密存储）">
            <Input.Password placeholder="sk-xxx..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
