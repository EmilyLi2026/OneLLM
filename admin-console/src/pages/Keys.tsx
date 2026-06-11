import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Typography, Tag, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, CopyOutlined, LinkOutlined, ExperimentOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { KeyBindings } from '../components/KeyBindings';

export function KeysPage() {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [keyRes, provRes, catalogRes] = await Promise.all([
        api.get('/keys'),
        api.get('/providers'),
        api.get('/models/providers'),
      ]);
      // Merge user credentials with catalog display names
      const catalogMap = new Map<string, string>();
      for (const p of (catalogRes.data.data || [])) {
        catalogMap.set(p.slug, p.name_cn || p.name);
      }
      const enrichedProviders = (provRes.data.data || []).map((p: any) => ({
        ...p,
        display_name: catalogMap.get(p.provider_name) || p.provider_name,
      }));
      setKeys(keyRes.data.data);
      setProviders(enrichedProviders);
      // 默认展开所有活跃 Key 行，显示 Provider 绑定
      setExpandedKeys((keyRes.data.data || []).filter((k: any) => !k.revoked).map((k: any) => k.id));
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      const { data } = await api.post('/keys', {
        name: values.name,
        rate_limit_rpm: values.rate_limit_rpm || 60,
        monthly_budget_cents: values.monthly_budget_cents || 0,
        daily_budget_cents: values.daily_budget_cents || 0,
      });
      setNewKey(data.data.key);
      message.success('API Key 创建成功');
      form.resetFields();
      // 不关闭弹窗，让用户看到 Key 并复制后再手动关闭
      fetchData();
    } catch (err: any) { message.error(err.response?.data?.message || '创建失败'); }
  };

  const handleRevoke = async (id: string) => {
    try { await api.delete(`/keys/${id}`); message.success('已吊销'); fetchData(); }
    catch { message.error('操作失败'); }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: 'Key', dataIndex: 'key_prefix', key: 'key', render: (t: string) => <code>{t}...</code> },
    { title: '速率限制', dataIndex: 'rate_limit_rpm', key: 'rpm', render: (v: number) => `${v} RPM` },
    {
      title: 'Provider 绑定', dataIndex: 'binding_count', key: 'bindings', width: 100,
      render: (v: number) => v > 0 ? <Tag color="blue">{v} 个</Tag> : <Tag color="default">0</Tag>,
    },
    // 日预算/月预算列暂时隐藏，后续通过预算控制页面统一展示
    { title: 'Scopes', dataIndex: 'scopes', key: 'scopes', render: (s: string[]) => s?.map((x: string) => <Tag key={x}>{x}</Tag>) },
    {
      title: '状态', dataIndex: 'revoked', key: 'status',
      render: (v: number) => v ? <Tag color="red">已吊销</Tag> : <Tag color="green">活跃</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created', render: (d: string) => new Date(d).toLocaleDateString('zh-CN') },
    {
      title: '操作', key: 'action', render: (_: any, r: any) => (
        <Button danger size="small" disabled={r.revoked === 1} onClick={() => handleRevoke(r.id)}>吊销</Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>API Keys（Agent级）</Typography.Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>创建 Key</Button>
          <Button icon={<ExperimentOutlined />} onClick={() => navigate('/keys/test')}>连接测试</Button>
        </Space>
      </div>

      {providers.length === 0 && (
        <Typography.Text type="warning" style={{ display: 'block', marginBottom: 16 }}>
          提示：如需通过 Key 直接调用模型，请先在「Provider 凭证」中添加上游模型厂商的真实 API Key
        </Typography.Text>
      )}

      <Table columns={columns} dataSource={keys} rowKey="id" loading={loading}
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpandedRowsChange: (rows) => setExpandedKeys(rows as string[]),
          expandedRowRender: (record: any) => (
            <KeyBindings keyId={record.id} providers={providers} />
          ),
          rowExpandable: (record: any) => record.revoked !== 1,
        }}
        scroll={{ y: 'calc(100vh - 280px)' }} />

      {/* Create Modal */}
      <Modal
        title="创建 API Key"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setNewKey(null); }}
        footer={newKey ? [
          <Button key="close" onClick={() => { setModalOpen(false); setNewKey(null); }}>关闭</Button>,
        ] : undefined}
        onOk={() => !newKey && form.submit()}
      >
        {newKey ? (
          <div>
            <Typography.Text type="danger" strong>请立即复制并安全保存此 Key，关闭后将无法再次查看！</Typography.Text>
            <Input.TextArea value={newKey} rows={2} style={{ marginTop: 8 }} readOnly />
            <Button icon={<CopyOutlined />} style={{ marginTop: 8 }} onClick={() => { navigator.clipboard.writeText(newKey); message.success('已复制'); }}>复制</Button>
          </div>
        ) : (
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入 Key 名称' }]}>
              <Input placeholder="如：production-key" />
            </Form.Item>
            <Typography.Text type="secondary">
              创建后请展开 Key 行添加 Provider 绑定。一个 Key 可绑定多个 Provider，支持主备路由。
            </Typography.Text>
            <div style={{ marginTop: 12 }}>
              <Alert type="info" showIcon style={{ fontSize: 12 }}
                message="预算设置已移至「预算控制」页面统一管理。创建 Key 后请前往预算控制页面设置 Key 及各 Provider 的预算。" />
            </div>
            <Space style={{ width: '100%', marginTop: 16 }} size="middle">
              <Form.Item name="rate_limit_rpm" label="速率限制 (RPM)" initialValue={60}>
                <Input type="number" min={1} max={10000} style={{ width: 150 }} />
              </Form.Item>
            </Space>
          </Form>
        )}
      </Modal>
    </div>
  );
}
