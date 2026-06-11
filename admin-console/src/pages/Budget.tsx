import { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Typography, Button, Spin, message, Tabs,
  Table, InputNumber, Tag, Space, Progress, Alert, Tooltip, Modal,
} from 'antd';
import {
  DollarOutlined, ThunderboltOutlined, WarningOutlined,
  SettingOutlined, DashboardOutlined, AlertOutlined,
  ReloadOutlined, RiseOutlined, FallOutlined, AimOutlined,
} from '@ant-design/icons';
import { Line, Pie } from '@ant-design/charts';
import { api } from '../api/client';

type BudgetLevel = 'normal' | 'warning' | 'throttle' | 'cutoff';
const LEVEL_CONFIG: Record<BudgetLevel, { color: string; label: string }> = {
  normal: { color: '#52c41a', label: '正常' },
  warning: { color: '#faad14', label: '预警' },
  throttle: { color: '#fa8c16', label: '限流' },
  cutoff: { color: '#ff4d4f', label: '熔断' },
};

export function BudgetPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [bindingModalOpen, setBindingModalOpen] = useState(false);
  const [editingBinding, setEditingBinding] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('settings');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, aRes, alRes] = await Promise.all([
        api.get('/budget/settings'),
        api.get('/budget/analytics'),
        api.get('/budget/alerts'),
      ]);
      setSettings(sRes.data.data);
      setAnalytics(aRes.data.data);
      setAlerts(alRes.data.data || []);
    } catch { message.error('加载预算数据失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveWorkspaceBudget = async (values: { monthly?: number; daily?: number }) => {
    setSaving(s => ({ ...s, workspace: true }));
    try {
      const body: any = {};
      if (values.monthly !== undefined) body.monthly_budget_cents = Math.round(values.monthly * 100);
      if (values.daily !== undefined) body.daily_budget_cents = Math.round(values.daily * 100);
      await api.put('/budget/settings/workspace', body);
      message.success('Workspace 预算已更新');
      fetchAll();
    } catch { message.error('保存失败'); }
    finally { setSaving(s => ({ ...s, workspace: false })); }
  };

  const saveKeyBudget = async (keyId: string, values: { monthly?: number; daily?: number }) => {
    setSaving(s => ({ ...s, [keyId]: true }));
    try {
      const body: any = {};
      if (values.monthly !== undefined) body.monthly_budget_cents = Math.round(values.monthly * 100);
      if (values.daily !== undefined) body.daily_budget_cents = Math.round(values.daily * 100);
      await api.put(`/budget/settings/keys/${keyId}`, body);
      message.success('Key 预算已更新');
      fetchAll();
    } catch { message.error('保存失败'); }
    finally { setSaving(s => ({ ...s, [keyId]: false })); }
  };

  const saveBindingBudget = async (bindingId: string, values: { monthly?: number; daily?: number }) => {
    setSaving(s => ({ ...s, [bindingId]: true }));
    try {
      const body: any = {};
      if (values.monthly !== undefined) body.monthly_budget_cents = Math.round(values.monthly * 100);
      if (values.daily !== undefined) body.daily_budget_cents = Math.round(values.daily * 100);
      await api.put(`/budget/settings/bindings/${bindingId}`, body);
      message.success('Binding 预算已更新');
      fetchAll();
    } catch { message.error('保存失败'); }
    finally { setSaving(s => ({ ...s, [bindingId]: false })); }
  };

  const saveAgentBudget = async (agentId: string, values: { daily_tokens?: number; monthly_cost?: number }) => {
    setSaving(s => ({ ...s, [agentId]: true }));
    try {
      const body: any = {};
      if (values.daily_tokens !== undefined) body.daily_token_limit = values.daily_tokens;
      if (values.monthly_cost !== undefined) body.monthly_cost_limit_cents = Math.round(values.monthly_cost * 100);
      await api.put(`/budget/settings/agents/${agentId}`, body);
      message.success('Agent 预算已更新');
      fetchAll();
    } catch { message.error('保存失败'); }
    finally { setSaving(s => ({ ...s, [agentId]: false })); }
  };

  // ── Helpers ──
  const budgetProgress = (spent: number, budget: number): { percent: number; level: BudgetLevel } => {
    const pct = budget > 0 ? Math.min(Math.round(spent / budget * 100), 999) : 0;
    let level: BudgetLevel = 'normal';
    if (pct >= 100) level = 'cutoff';
    else if (pct >= 85) level = 'throttle';
    else if (pct >= 70) level = 'warning';
    return { percent: pct, level };
  };

  const levelTag = (level: BudgetLevel) => (
    <Tag color={LEVEL_CONFIG[level].color}>{LEVEL_CONFIG[level].label}</Tag>
  );

  const yuan = (cents: number) => (cents / 100).toFixed(2);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const ws = analytics?.workspace || {};

  // ── Tab: Settings ──
  const settingsTab = (
    <div>
      {/* Workspace Budget */}
      <Card title={<><SettingOutlined /> Workspace 预算设置</>} style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Statistic title="月预算 (元)" value={settings?.workspace?.monthly_budget_cents / 100}
              prefix={<DollarOutlined />} precision={2} />
            <div style={{ marginTop: 8 }}>
              <Space>
                <InputNumber min={0} step={10} style={{ width: 160 }}
                  placeholder="月预算 (元)"
                  defaultValue={settings?.workspace?.monthly_budget_cents / 100}
                  onBlur={(e) => {
                    const v = parseFloat((e.target as HTMLInputElement).value);
                    if (!isNaN(v) && v >= 0) saveWorkspaceBudget({ monthly: v });
                  }} />
                <Button size="small" type="primary" loading={saving['workspace']}
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('.ws-monthly input');
                    if (input) saveWorkspaceBudget({ monthly: parseFloat(input.value) || 0 });
                  }}>保存</Button>
              </Space>
            </div>
          </Col>
          <Col span={8}>
            <Statistic title="日预算 (元)" value={settings?.workspace?.daily_budget_cents / 100}
              prefix={<DollarOutlined />} precision={2} />
            <div style={{ marginTop: 8 }}>
              <Space>
                <InputNumber min={0} step={1} style={{ width: 160 }}
                  placeholder="日预算 (元)"
                  defaultValue={settings?.workspace?.daily_budget_cents / 100}
                  onBlur={(e) => {
                    const v = parseFloat((e.target as HTMLInputElement).value);
                    if (!isNaN(v) && v >= 0) saveWorkspaceBudget({ daily: v });
                  }} />
                <Button size="small" type="primary" loading={saving['workspace']}
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('.ws-daily input');
                    if (input) saveWorkspaceBudget({ daily: parseFloat(input.value) || 0 });
                  }}>保存</Button>
              </Space>
            </div>
          </Col>
          <Col span={8}>
            <Alert type="info" showIcon style={{ fontSize: 12 }}
              message="预算层级说明"
              description={
                <div style={{ fontSize: 11 }}>
                  <div>🟢 正常: &lt;70% | 🟡 预警: 70-85% | 🟠 限流: 85-100% (RPM减半) | 🔴 熔断: ≥100% (402拦截)</div>
                  <div style={{ marginTop: 4 }}>日预算和月预算独立计算，任一超限即触发对应控制动作。</div>
                </div>
              } />
          </Col>
        </Row>
      </Card>

      {/* API Key Budgets — 三级预算：Workspace(一级) → Key(二级) → Provider(三级) */}
      <Card title={<><DollarOutlined /> API Key 预算 (二级)</>}
        extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>
          💡 Key 预算 = 硬上限 · 展开行设置各 Provider 子预算
        </Typography.Text>}
        style={{ marginBottom: 16 }}>
        <Table
          dataSource={(settings?.api_keys || []).filter((k: any) => k.binding_count > 0)}
          rowKey="id"
          pagination={false}
          expandable={{
            defaultExpandAllRows: true,
            expandedRowRender: (key: any) => {
              const bindingMonthlyTotal = (key.bindings || []).reduce((s: number, b: any) => s + (b.monthly_budget_cents || 0), 0);
              const bindingDailyTotal = (key.bindings || []).reduce((s: number, b: any) => s + (b.daily_budget_cents || 0), 0);
              const keyMonthly = key.monthly_budget_cents || 0;
              const keyDaily = key.daily_budget_cents || 0;
              return (
              <div style={{ padding: '0 24px 8px' }}>
                {/* Hierarchy hint */}
                {((keyMonthly > 0 && bindingMonthlyTotal > keyMonthly) || (keyDaily > 0 && bindingDailyTotal > keyDaily)) && (
                  <Alert type="warning" showIcon style={{ marginBottom: 12, fontSize: 12 }}
                    message="Provider 子预算合计超过 Key 总预算，Key 总预算将作为硬上限优先生效" />
                )}
                <Table
                  dataSource={key.bindings || []}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  title={() => (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Provider 子预算 (三级) — 各 Provider 独立上限，合计不得超过 Key 总预算
                      {keyMonthly > 0 && <> · Key 月总预算 ¥{yuan(keyMonthly)} · 子预算合计 ¥{yuan(bindingMonthlyTotal)}</>}
                    </Typography.Text>
                  )}
                  columns={[
                    {
                      title: 'Provider', dataIndex: 'provider_name', width: 120,
                      render: (v: string) => <Tag color="blue">{v}</Tag>,
                    },
                    {
                      title: '优先级', dataIndex: 'priority_order', width: 70,
                      render: (v: number) => <Tag color={v === 1 ? 'green' : 'orange'}>{v === 1 ? '首选' : `第${v}备`}</Tag>,
                    },
                    {
                      title: '允许模型', dataIndex: 'allowed_models', width: 200,
                      render: (m: string[] | null) =>
                        m ? m.map((x: string) => <Tag key={x} style={{ fontSize: 11 }}>{x}</Tag>) : <Tag color="default">全部</Tag>,
                    },
                    {
                      title: '月预算/已用', key: 'monthly', width: 180,
                      render: (_: any, b: any) => {
                        const { percent, level } = budgetProgress(b.monthly_spent, b.monthly_budget_cents);
                        return (
                          <div>
                            <span style={{ fontSize: 12 }}>¥{yuan(b.monthly_spent)} / ¥{yuan(b.monthly_budget_cents)}</span>
                            {b.monthly_budget_cents > 0 && (
                              <Progress percent={Math.min(percent, 100)} size="small" strokeColor={LEVEL_CONFIG[level].color} />
                            )}
                          </div>
                        );
                      },
                    },
                    {
                      title: '日预算/已用', key: 'daily', width: 180,
                      render: (_: any, b: any) => {
                        const { percent, level } = budgetProgress(b.daily_spent, b.daily_budget_cents);
                        return (
                          <div>
                            <span style={{ fontSize: 12 }}>¥{yuan(b.daily_spent)} / ¥{yuan(b.daily_budget_cents)}</span>
                            {b.daily_budget_cents > 0 && (
                              <Progress percent={Math.min(percent, 100)} size="small" strokeColor={LEVEL_CONFIG[level].color} />
                            )}
                          </div>
                        );
                      },
                    },
                    {
                      title: '设置', key: 'action', width: 180,
                      render: (_: any, b: any) => (
                        <Button size="small" type="link" icon={<SettingOutlined />}
                          onClick={() => { setEditingBinding(b); setBindingModalOpen(true); }}>
                          编辑预算
                        </Button>
                      ),
                    },
                  ]}
                />
              </div>
            )},
          }}
          columns={[
            { title: 'Key 名称', dataIndex: 'name', width: 130 },
            {
              title: '绑定', dataIndex: 'binding_count', width: 60,
              render: (v: number) => <Tag color="blue">{v}</Tag>,
            },
            {
              title: '月预算 (元)', key: 'key_monthly_budget', width: 140,
              render: (_: any, r: any) => (
                <InputNumber size="small" min={0} step={10} style={{ width: 100 }}
                  placeholder="硬上限"
                  defaultValue={r.monthly_budget_cents / 100}
                  onPressEnter={(e) => saveKeyBudget(r.id, { monthly: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                  onBlur={(e) => {
                    const v = parseFloat((e.target as HTMLInputElement).value);
                    if (!isNaN(v) && v >= 0 && v !== r.monthly_budget_cents / 100) {
                      saveKeyBudget(r.id, { monthly: v });
                    }
                  }} />
              ),
            },
            {
              title: '日预算 (元)', key: 'key_daily_budget', width: 140,
              render: (_: any, r: any) => (
                <InputNumber size="small" min={0} step={1} style={{ width: 100 }}
                  placeholder="硬上限"
                  defaultValue={r.daily_budget_cents / 100}
                  onPressEnter={(e) => saveKeyBudget(r.id, { daily: parseFloat((e.target as HTMLInputElement).value) || 0 })}
                  onBlur={(e) => {
                    const v = parseFloat((e.target as HTMLInputElement).value);
                    if (!isNaN(v) && v >= 0 && v !== r.daily_budget_cents / 100) {
                      saveKeyBudget(r.id, { daily: v });
                    }
                  }} />
              ),
            },
            {
              title: '月已用 / 进度', key: 'key_monthly_used', width: 190,
              render: (_: any, r: any) => {
                const { percent, level } = budgetProgress(r.monthly_spent, r.monthly_budget_cents);
                return (
                  <div>
                    <span style={{ fontSize: 12 }}>¥{yuan(r.monthly_spent)} / ¥{yuan(r.monthly_budget_cents)}</span>
                    {r.monthly_budget_cents > 0 ? (
                      <Progress percent={Math.min(percent, 100)} size="small" strokeColor={LEVEL_CONFIG[level].color} />
                    ) : <Typography.Text type="secondary" style={{ fontSize: 11 }}>未设置</Typography.Text>}
                    {r.monthly_budget_cents > 0 && levelTag(level)}
                  </div>
                );
              },
            },
            {
              title: '日已用', key: 'key_daily_used', width: 150,
              render: (_: any, r: any) => {
                const { percent, level } = budgetProgress(r.daily_spent, r.daily_budget_cents);
                return (
                  <div>
                    <span style={{ fontSize: 12 }}>¥{yuan(r.daily_spent)} / ¥{yuan(r.daily_budget_cents)}</span>
                    {r.daily_budget_cents > 0 ? (
                      <Progress percent={Math.min(percent, 100)} size="small" strokeColor={LEVEL_CONFIG[level].color} />
                    ) : <Typography.Text type="secondary" style={{ fontSize: 11 }}>未设置</Typography.Text>}
                  </div>
                );
              },
            },
          ]}
          locale={{ emptyText: '暂无已绑定 Provider 的 Key，请先在「API Keys」页面创建 Key 并添加绑定' }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Binding Budget Edit Modal */}
      <Modal
        title="编辑 Provider 绑定预算"
        open={bindingModalOpen}
        onCancel={() => { setBindingModalOpen(false); setEditingBinding(null); }}
        onOk={() => {
          if (!editingBinding) return;
          const mInput = document.querySelector<HTMLInputElement>('.bind-monthly input');
          const dInput = document.querySelector<HTMLInputElement>('.bind-daily input');
          saveBindingBudget(editingBinding.id, {
            monthly: mInput ? parseFloat(mInput.value) || 0 : undefined,
            daily: dInput ? parseFloat(dInput.value) || 0 : undefined,
          });
          setBindingModalOpen(false);
          setEditingBinding(null);
        }}
      >
        {editingBinding && (
          <div>
            <p>
              <Tag color="blue">{editingBinding.provider_name}</Tag>
              <Tag color={editingBinding.priority_order === 1 ? 'green' : 'orange'}>
                {editingBinding.priority_order === 1 ? '首选' : `第${editingBinding.priority_order}备选`}
              </Tag>
            </p>
            <Space style={{ width: '100%' }} size="middle">
              <div className="bind-monthly">
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>月预算 (元)</Typography.Text>
                <InputNumber min={0} step={1} style={{ width: 140 }}
                  defaultValue={editingBinding.monthly_budget_cents / 100} />
              </div>
              <div className="bind-daily">
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>日预算 (元)</Typography.Text>
                <InputNumber min={0} step={1} style={{ width: 140 }}
                  defaultValue={editingBinding.daily_budget_cents / 100} />
              </div>
            </Space>
            <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
              月已用: ¥{yuan(editingBinding.monthly_spent)} | 日已用: ¥{yuan(editingBinding.daily_spent)}
            </div>
          </div>
        )}
      </Modal>

      {/* Agent Budgets */}
      {/* --- Agent 预算 (Phase 2 启用) ---
      <Card title={<><ThunderboltOutlined /> Agent 预算</>}>
        <Table
          dataSource={settings?.agents || []}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'Agent 名称', dataIndex: 'name', width: 160 },
            { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag>, width: 80 },
            {
              title: '日 Token 上限', dataIndex: 'daily_token_limit', width: 120,
              render: (v: number) => v > 0 ? v.toLocaleString() : '未设置',
            },
            {
              title: '今日已用', dataIndex: 'daily_tokens_used', width: 120,
              render: (v: number, r: any) => {
                const pct = r.daily_token_limit > 0 ? Math.round(v / r.daily_token_limit * 100) : 0;
                const level = r.daily_token_limit > 0 ? budgetProgress(v, r.daily_token_limit).level : 'normal';
                return (
                  <div>
                    <span>{v.toLocaleString()}</span>
                    {r.daily_token_limit > 0 && (
                      <Progress percent={Math.min(pct, 100)} size="small" strokeColor={LEVEL_CONFIG[level].color} />
                    )}
                  </div>
                );
              },
            },
            {
              title: '月花费上限 (元)', dataIndex: 'monthly_cost_limit_cents', width: 130,
              render: (v: number) => v > 0 ? `¥${(v / 100).toFixed(2)}` : '未设置',
            },
            {
              title: '本月已用', key: 'monthly_cost', width: 140,
              render: (_: any, r: any) => {
                const pct = r.monthly_cost_limit_cents > 0 ? Math.round(r.monthly_cost_cents / r.monthly_cost_limit_cents * 100) : 0;
                const level = r.monthly_cost_limit_cents > 0 ? budgetProgress(r.monthly_cost_cents, r.monthly_cost_limit_cents).level : 'normal';
                return (
                  <div>
                    <span>¥{yuan(r.monthly_cost_cents)}</span>
                    {r.monthly_cost_limit_cents > 0 && (
                      <Progress percent={Math.min(pct, 100)} size="small" strokeColor={LEVEL_CONFIG[level].color} />
                    )}
                  </div>
                );
              },
            },
            {
              title: '设置', key: 'set', width: 200,
              render: (_: any, r: any) => (
                <Space size={4}>
                  <InputNumber size="small" min={0} step={10000} style={{ width: 80 }}
                    placeholder="日Token" defaultValue={r.daily_token_limit}
                    onPressEnter={(e) => saveAgentBudget(r.id, { daily_tokens: parseInt((e.target as HTMLInputElement).value) || 0 })} />
                  <InputNumber size="small" min={0} step={10} style={{ width: 80 }}
                    placeholder="月花费" defaultValue={r.monthly_cost_limit_cents / 100}
                    onPressEnter={(e) => saveAgentBudget(r.id, { monthly_cost: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
                  <Button size="small" type="link">保存</Button>
                </Space>
              ),
            },
          ]}
          locale={{ emptyText: '暂无 Agent' }}
        />
      </Card>
      --- Agent 预算 end --- */}
    </div>
  );

  // ── Tab: Analytics ──
  const analyticsTab = (
    <div>
      {/* Gauge Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card size="small" style={{ height: 130 }}>
            <Statistic title="月预算利用率" value={ws.monthly_percent || 0}
              suffix="%" prefix={<DollarOutlined />}
              valueStyle={{ fontSize: 22, color: ws.monthly_percent >= 85 ? '#ff4d4f' : ws.monthly_percent >= 70 ? '#fa8c16' : '#1677ff' }} />
            <Progress percent={Math.min(ws.monthly_percent || 0, 100)} size="small"
              strokeColor={budgetProgress(ws.monthly_spent_cents || 0, ws.monthly_budget_cents || 0).level === 'cutoff' ? '#ff4d4f' : '#1677ff'} />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              ¥{yuan(ws.monthly_spent_cents || 0)} / ¥{yuan(ws.monthly_budget_cents || 0)}
            </Typography.Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ height: 130 }}>
            <Statistic title="日预算利用率" value={ws.daily_percent || 0}
              suffix="%" prefix={<ThunderboltOutlined />}
              valueStyle={{ fontSize: 22, color: ws.daily_percent >= 85 ? '#ff4d4f' : ws.daily_percent >= 70 ? '#fa8c16' : '#1677ff' }} />
            <Progress percent={Math.min(ws.daily_percent || 0, 100)} size="small"
              strokeColor={budgetProgress(ws.daily_spent_cents || 0, ws.daily_budget_cents || 0).level === 'cutoff' ? '#ff4d4f' : '#1677ff'} />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              ¥{yuan(ws.daily_spent_cents || 0)} / ¥{yuan(ws.daily_budget_cents || 0)}
            </Typography.Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ height: 130 }}>
            <Statistic title="月已花费" value={`¥${yuan(ws.monthly_spent_cents || 0)}`}
              valueStyle={{ fontSize: 22 }} />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>预算 ¥{yuan(ws.monthly_budget_cents || 0)}</Typography.Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ height: 130 }}>
            <Statistic title="今日花费" value={`¥${yuan(ws.daily_spent_cents || 0)}`}
              valueStyle={{ fontSize: 22 }} />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>日预算 ¥{yuan(ws.daily_budget_cents || 0)}</Typography.Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ height: 130 }}>
            <Tooltip title="(月预算 - 月已花费) ÷ 日均消费速率">
              <Statistic title="预测剩余天数" value={ws.forecast_days_remaining ?? '-'}
                prefix={<AimOutlined />} suffix={ws.forecast_days_remaining !== null ? '天' : ''}
                valueStyle={{ fontSize: 22, color: (ws.forecast_days_remaining || 0) < 7 ? '#ff4d4f' : '#1677ff' }} />
            </Tooltip>
            <Typography.Text type="secondary" style={{ fontSize: 10 }}>
              剩余 ¥{yuan((ws.monthly_budget_cents || 0) - (ws.monthly_spent_cents || 0))} ÷ 日均 ¥{yuan((ws.monthly_spent_cents || 0) / Math.max(new Date().getDate(), 1))}
            </Typography.Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ height: 130 }}>
            <Tooltip title="(月预算 - 月已花费) ÷ 本月剩余天数">
              <Statistic title="建议日消费" value={ws.suggested_daily_limit ? `¥${yuan(ws.suggested_daily_limit)}` : '-'}
                prefix={<RiseOutlined />}
                valueStyle={{ fontSize: 22, color: '#1677ff' }} />
            </Tooltip>
            <Typography.Text type="secondary" style={{ fontSize: 10 }}>
              剩余 ¥{yuan((ws.monthly_budget_cents || 0) - (ws.monthly_spent_cents || 0))} ÷ 剩余 {(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate(); })()} 天
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={14}>
          <Card title="📈 每日花费 & 预算警戒线" size="small" style={{ height: 380 }}>
            {(analytics?.daily_trend || []).length > 0 ? (
              <Line
                height={300}
                data={(analytics?.daily_trend || []).flatMap((d: any) => [
                  { date: d.date, type: '实际花费', value: d.cost_yuan },
                  ...(d.budget_line ? [{ date: d.date, type: '日预算线', value: d.budget_line }] : []),
                ])}
                xField="date"
                yField="value"
                seriesField="type"
                smooth
                color={['#1677ff', '#ff4d4f']}
                point={{ size: 3 }}
                legend={{ position: 'top' }}
                tooltip={{ items: [
                  { channel: 'y', valueFormatter: (v: number) => `¥${v.toFixed(2)}` },
                ]}}
              />
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', paddingTop: 120 }}>暂无花费数据</Typography.Text>
            )}
          </Card>
        </Col>
        <Col span={10}>
          <Card title="🥧 本月花费构成 (按 Key)" size="small" style={{ height: 380 }}>
            {(analytics?.breakdown_by_key || []).filter((b: any) => b.cost_yuan > 0).length > 0 ? (
              <Pie
                height={300}
                data={(analytics?.breakdown_by_key || []).filter((b: any) => b.cost_yuan > 0).map((b: any) => ({
                  type: b.name, value: b.cost_yuan,
                }))}
                angleField="value" colorField="type"
                radius={0.8} innerRadius={0.5}
                label={{ text: 'type', position: 'outside', style: { fontSize: 11 } }}
                legend={{ color: { position: 'bottom' } }}
                tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => `¥${v.toFixed(2)}` }] }}
                autoFit
              />
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', paddingTop: 120 }}>暂无数据</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Model breakdown + Alerts summary */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="📊 模型花费占比" size="small">
            <Table
              dataSource={analytics?.breakdown_by_model || []}
              rowKey="name"
              pagination={false}
              size="small"
              columns={[
                { title: '模型', dataIndex: 'name' },
                { title: '花费', dataIndex: 'cost_yuan', render: (v: number) => <strong>¥{v.toFixed(4)}</strong>, width: 100 },
                {
                  title: '占比', dataIndex: 'percent', width: 150,
                  render: (v: number) => <Progress percent={v} size="small" />,
                },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title={<><AlertOutlined /> 近期告警</>} size="small">
            {alerts.length > 0 ? (
              <Table
                dataSource={alerts}
                rowKey={(r: any) => r.id || r.notified_at}
                pagination={false}
                size="small"
                columns={[
                  { title: '类型', dataIndex: 'alert_type', width: 180, render: (v: string) => {
                    const level = v.includes('cutoff') ? 'cutoff' : v.includes('throttle') ? 'throttle' : 'warning';
                    return <Tag color={LEVEL_CONFIG[level as BudgetLevel].color}>{v}</Tag>;
                  }},
                  { title: '阈值', dataIndex: 'threshold_percent', width: 70, render: (v: number) => `${v}%` },
                  { title: '时间', dataIndex: 'notified_at', render: (d: string) => new Date(d).toLocaleString('zh-CN') },
                ]}
              />
            ) : (
              <Typography.Text type="secondary">暂无告警记录</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          💰 预算控制
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={fetchAll} size="small">刷新</Button>
      </div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'settings', label: <><SettingOutlined /> 预算设置</>, children: settingsTab },
        { key: 'analytics', label: <><DashboardOutlined /> 预算分析</>, children: analyticsTab },
        { key: 'alerts', label: <><AlertOutlined /> 告警记录 ({alerts.length})</>, children: (
          <Card title="告警历史">
            <Table
              dataSource={alerts}
              rowKey={(r: any) => r.id || r.notified_at}
              pagination={{ pageSize: 20 }}
              columns={[
                { title: '类型', dataIndex: 'alert_type', width: 200, render: (v: string) => {
                  const level = v.includes('cutoff') ? 'cutoff' : v.includes('throttle') ? 'throttle' : 'warning';
                  return <Tag color={LEVEL_CONFIG[level as BudgetLevel].color}>{v}</Tag>;
                }},
                { title: '阈值', dataIndex: 'threshold_percent', width: 80, render: (v: number) => `${v}%` },
                { title: '资源', dataIndex: 'resource_id', render: (v: string) => v ? <code>{v.substring(0, 16)}...</code> : '-' },
                { title: '时间', dataIndex: 'notified_at', render: (d: string) => new Date(d).toLocaleString('zh-CN') },
              ]}
              locale={{ emptyText: '暂无告警' }}
            />
          </Card>
        ),
      }]} />
    </div>
  );
}
