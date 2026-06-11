import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, Typography, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { agentsAPI } from '../api/client';

const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { value: 'deepseek-v3', label: 'DeepSeek V3' },
  { value: 'qwen-max', label: '通义千问 Max' },
  { value: 'glm-4', label: '智谱 GLM-4' },
];

export function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const { data } = await agentsAPI.list();
      setAgents(data.data);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAgents(); }, []);

  const handleCreate = async (values: any) => {
    try {
      const { data } = await agentsAPI.create(values);
      message.success('Agent 创建成功');
      setModalOpen(false);
      form.resetFields();
      fetchAgents();
    } catch (err: any) {
      message.error(err.response?.data?.message || '创建失败');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name',
      render: (text: string, r: any) => <a onClick={() => navigate(`/agents/${r.id}`)}>{text}</a> },
    { title: '默认模型', dataIndex: 'default_model', key: 'model' },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'orange'}>{s === 'active' ? '运行中' : s}</Tag> },
    { title: 'Execution Tier', dataIndex: 'execution_tier', key: 'tier', render: (t: number) => `T${t}` },
    { title: '创建时间', dataIndex: 'created_at', key: 'created', render: (d: string) => new Date(d).toLocaleDateString('zh-CN') },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Agent 管理</Typography.Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建 Agent</Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={agents} rowKey="id" loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: '暂无 Agent，点击"新建 Agent"开始' }} />

      <Modal title="新建 Agent" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如：客服Agent" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="描述 Agent 的功能" />
          </Form.Item>
          <Form.Item name="default_model" label="默认模型" initialValue="gpt-4o-mini">
            <Select options={MODEL_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
