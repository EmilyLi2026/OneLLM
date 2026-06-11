import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Select, Input, Switch, Space, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { bindingsAPI } from '../api/client';
import { api } from '../api/client';

interface Binding {
  id: string; api_key_id: string; provider_credential_id: string;
  priority_order: number; weight: number; enabled: number;
  allowed_models: string[] | null;
  daily_budget_cents: number; monthly_budget_cents: number; created_at: string;
  provider_name?: string; api_key_preview?: string;
}

export function KeyBindings({ keyId, providers }: { keyId: string; providers: any[] }) {
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBinding, setEditingBinding] = useState<Binding | null>(null);
  const [form] = Form.useForm();

  const fetchBindings = async () => {
    setLoading(true);
    try {
      const { data } = await bindingsAPI.list(keyId);
      setBindings(data.data);
    } catch { message.error('Bindings load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBindings(); }, [keyId]);

  // ── Model loading when provider changes ──
  const [availableModels, setAvailableModels] = useState<{ label: string; value: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const loadModelsForProvider = async (providerCredentialId: string) => {
    const prov = providers.find((p: any) => p.id === providerCredentialId);
    if (!prov) { setAvailableModels([]); return; }
    setModelsLoading(true);
    try {
      const { data } = await api.get('/models', {
        params: { provider: prov.provider_name, limit: 200 },
      });
      const modelList = data.data?.models || data.data || [];
      // Use provider_model_id as value so it matches what the Playground sends to the API.
      // Dedup: when multiple catalog entries share the same provider_model_id, keep the one
      // with a namespaced model_id (OpenRouter synced = preferred).
      const seen = new Set<string>();
      const models: { label: string; value: string }[] = [];
      for (const m of (Array.isArray(modelList) ? modelList : [])) {
        const pid = m.provider_model_id || m.model_id;
        if (seen.has(pid)) {
          // Replace if this entry is OpenRouter-synced and the previous wasn't
          const existing = models.find(x => x.value === pid);
          if (existing && m.model_id?.includes('/') && !existing.label.includes('/')) {
            existing.label = `${m.name || pid} (${pid})`;
          }
          continue;
        }
        seen.add(pid);
        models.push({
          label: `${m.name || pid} (${pid})`,
          value: pid,
        });
      }
      setAvailableModels(models);
    } catch {
      setAvailableModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        provider_credential_id: values.provider_credential_id,
        priority_order: values.priority_order,
        allowed_models: values.allowed_models?.length > 0 ? values.allowed_models : null,
      };
      if (editingBinding) {
        await bindingsAPI.update(keyId, editingBinding.id, payload);
        message.success('Binding updated');
      } else {
        await bindingsAPI.create(keyId, payload);
        message.success('Binding added');
      }
      setModalOpen(false);
      setEditingBinding(null);
      form.resetFields();
      fetchBindings();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (bindingId: string) => {
    try {
      await bindingsAPI.delete(keyId, bindingId);
      message.success('Binding removed');
      fetchBindings();
    } catch { message.error('Delete failed'); }
  };

  const openEdit = (b: Binding) => {
    setEditingBinding(b);
    form.setFieldsValue({
      provider_credential_id: b.provider_credential_id,
      priority_order: b.priority_order,
      enabled: b.enabled === 1,
      allowed_models: b.allowed_models || [],
    });
    setModalOpen(true);
    if (b.provider_credential_id) loadModelsForProvider(b.provider_credential_id);
  };

  const columns = [
    {
      title: 'Provider', dataIndex: 'provider_name', key: 'provider',
      render: (t: string, r: Binding) => {
        const prov = providers.find((p: any) => p.provider_name === t);
        const label = prov?.display_name || t;
        return (
          <Space>
            <Tag color="blue">{label}</Tag>
            <Tag color={r.priority_order === 1 ? 'green' : 'orange'}>{r.priority_order === 1 ? '首选' : `第${r.priority_order}备`}</Tag>
          </Space>
        );
      },
    },
    {
      title: '可用模型', dataIndex: 'allowed_models', key: 'models',
      render: (m: string[] | null) =>
        m ? m.map((x: string) => <Tag key={x}>{x}</Tag>) : <Tag color="default">全部</Tag>,
    },
    {
      title: '操作', key: 'action',
      render: (_: any, r: Binding) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Remove this binding?" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Provider 绑定 ({bindings.length})</strong>
        <Button size="small" type="dashed" icon={<PlusOutlined />}
          disabled={providers.length === 0}
          onClick={() => { setEditingBinding(null); form.resetFields(); setAvailableModels([]); setModalOpen(true); }}>
          添加 Provider
        </Button>
      </div>
      <Table columns={columns} dataSource={bindings} rowKey="id" loading={loading}
        size="small" pagination={false} scroll={{ y: 300 }} />
      <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
        💡 预算设置请前往 <a href="/budget" style={{ fontWeight: 500 }}>预算控制</a> 页面，支持按 Key / Provider 独立设置预算
      </div>

      <Modal
        title={editingBinding ? '编辑绑定' : '添加 Provider 绑定'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingBinding(null); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="provider_credential_id" label="Provider"
            rules={[{ required: true, message: 'Select a provider' }]}>
            <Select
              disabled={!!editingBinding}
              placeholder="选择 Provider 凭证"
              options={providers.map((p: any) => ({
                value: p.id,
                label: p.display_name || p.provider_name,
              }))}
              onChange={(val) => { if (val) loadModelsForProvider(val); }}
            />
          </Form.Item>
          <Form.Item name="priority_order" label="优先级顺序" initialValue={1}
            tooltip="数字越小越优先，1=首选，2=第一备选，3=第二备选...">
            <Select options={[
              { value: 1, label: '1 — 首选' },
              { value: 2, label: '2 — 第一备选' },
              { value: 3, label: '3 — 第二备选' },
              { value: 4, label: '4 — 第三备选' },
              { value: 5, label: '5 — 第四备选' },
            ]} style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="allowed_models" label="限制模型（可选）" tooltip="留空表示该 Provider 下所有模型可用">
            <Select
              mode="multiple"
              placeholder={modelsLoading ? '加载模型列表中...' : '选择模型，留空 = 全部可用'}
              options={availableModels}
              loading={modelsLoading}
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          {editingBinding && (
            <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
