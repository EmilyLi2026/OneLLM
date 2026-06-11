import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Typography, Tag, Spin, Progress, List, Space, Tooltip, Button } from 'antd';
import {
  RobotOutlined, DollarOutlined, ApiOutlined,
  KeyOutlined, CloudServerOutlined, AppstoreOutlined,
  WarningOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, ArrowRightOutlined, RocketOutlined,
} from '@ant-design/icons';
import { Line, Column, Pie } from '@ant-design/charts';
import { api } from '../api/client';

// ── Helpers ──
const yuan = (cents: number) => (cents / 100).toFixed(2);
const pct = (v: number, total: number) => total > 0 ? Math.round(v / total * 100) : 0;
const budgetLevel = (spent: number, budget: number) => {
  if (!budget || budget === 0) return null;
  const p = Math.round(spent / budget * 100);
  if (p >= 100) return { color: '#ff4d4f', status: 'exception' as const };
  if (p >= 85) return { color: '#fa8c16', status: 'active' as const };
  if (p >= 70) return { color: '#faad14', status: 'active' as const };
  return { color: '#1677ff', status: 'normal' as const };
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [data, setData] = useState<any>({});

  useEffect(() => {
    (async () => {
      try {
        const [
          agentsRes, keysRes, provRes, statsRes, trendRes, budgetRes, auditRes, logsRes,
        ] = await Promise.all([
          api.get('/agents'),
          api.get('/keys'),
          api.get('/models/providers'),
          api.get('/logs/stats', { params: { group_by: 'model' } }),
          api.get('/logs/trend'),
          api.get('/budget/analytics'),
          api.get('/audit', { params: { limit: 6 } }),
          api.get('/logs', { params: { limit: 6 } }),
        ]);
        setData({
          agents: agentsRes.data.data || [],
          keys: keysRes.data.data || [],
          providers: provRes.data.data || [],
          modelStats: statsRes.data.data || {},
          trend: trendRes.data.data || [],
          budget: budgetRes.data.data || null,
          auditLogs: auditRes.data.data?.logs || [],
          requestLogs: logsRes.data.data?.logs || [],
        });
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const {
    agents = [], keys = [], providers = [], modelStats = {},
    trend = [], budget, auditLogs = [], requestLogs = [],
  } = data;

  const activeAgents = agents.filter((a: any) => a.status === 'active').length;
  const modelCount = providers.reduce((s: number, p: any) => s + (p.model_count || 0), 0);
  const ws = budget?.workspace || {};
  const alerts = budget?.recent_alerts || [];

  // Trend data
  const trendData = (trend || []).map((d: any) => ({
    date: d.date,
    cost: Number(d.total_cost_cents) / 100,
    tokens: Number(d.total_tokens_in) + Number(d.total_tokens_out),
    requests: Number(d.total_requests),
  }));
  const totalSpent = trendData.reduce((s: number, d: any) => s + d.cost, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>AI 总览</Typography.Title>
        {!showGuide && (
          <Button icon={<RocketOutlined />} onClick={() => setShowGuide(true)}>
            快速上手
          </Button>
        )}
      </div>

      {/* ════ Onboarding: 快速上手引导 ════ */}
      {showGuide && (
        <Card
          style={{ marginBottom: 20, borderRadius: 12, border: '1px solid #d6e4ff', background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)' }}
          bodyStyle={{ padding: '24px 28px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <RocketOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Typography.Text strong style={{ fontSize: 16 }}>🚀 快速上手 — 三步完成接入</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 13, marginLeft: 12 }}>
              按照以下步骤操作，3 分钟即可开始调用
            </Typography.Text>
            <Button type="text" size="small" style={{ marginLeft: 'auto', color: '#8c8c8c' }}
              onClick={(e) => { e.stopPropagation(); setShowGuide(false); }}>
              ✕ 收起
            </Button>
          </div>
          <Row gutter={16}>
            {[
              { num: 1, title: '配置 Provider', path: '/providers',
                desc: '添加上游模型厂商的 API Key（如 DeepSeek、阿里百炼等），AES-256 加密存储。',
                done: providers.length > 0, color: '#722ed1', bg: '#f9f0ff' },
              { num: 2, title: '创建 API Key', path: '/keys',
                desc: '创建属于你自己的 API Key，可选择绑定一个或多个 Provider，设置预算上限。',
                done: keys.length > 0, color: '#1677ff', bg: '#e6f4ff' },
              { num: 3, title: '发起调用', path: '/keys/test',
                desc: '在 Playground 中测试，或用标准 OpenAI SDK 发起调用。只需修改 baseURL 和 API Key。',
                done: false, color: '#52c41a', bg: '#f6ffed' },
            ].map((step) => (
              <Col span={8} key={step.num}>
                <div onClick={() => navigate(step.path)} style={{
                  background: '#fff', borderRadius: 10, padding: '16px 18px',
                  border: `1px solid ${step.done ? '#b7eb8f' : '#e8e8e8'}`,
                  cursor: 'pointer', transition: 'all .2s', position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: step.bg, color: step.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                      {step.num}
                    </div>
                    <Typography.Text strong style={{ fontSize: 14 }}>{step.title}</Typography.Text>
                    {step.done && <Tag color="success" style={{ marginLeft: 'auto', fontSize: 11 }}>已完成</Tag>}
                  </div>
                  <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.6 }}>{step.desc}</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <Typography.Link style={{ fontSize: 12 }}>前往设置 <ArrowRightOutlined style={{ fontSize: 10 }} /></Typography.Link>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* ════ Layer 1: Core Metrics ════ */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { title: '活跃 Agent', value: activeAgents, icon: <RobotOutlined />, color: '#1677ff', path: '/agents' },
          { title: 'API Keys', value: keys.length, icon: <KeyOutlined />, color: '#52c41a', path: '/keys' },
          { title: '模型总数', value: modelCount, icon: <AppstoreOutlined />, color: '#722ed1', path: '/models' },
          { title: 'Provider 已接入', value: providers.length, icon: <CloudServerOutlined />, color: '#13c2c2', path: '/providers' },
          { title: '本月花费', value: `¥${yuan(ws.monthly_spent_cents || 0)}`, icon: <DollarOutlined />, color: '#cf1322', path: '/costs', suffix: '' },
          { title: '今日请求', value: trendData[trendData.length - 1]?.requests || 0, icon: <ApiOutlined />, color: '#fa8c16', path: '/logs', suffix: '', format: (v: any) => typeof v === 'number' ? v.toLocaleString() : v },
        ].map((m, i) => (
          <Col span={4} key={i}>
            <Card hoverable size="small" onClick={() => navigate(m.path)} style={{ cursor: 'pointer' }}>
              <Statistic
                title={m.title}
                value={m.format ? m.format(m.value) : m.value}
                prefix={<span style={{ color: m.color }}>{m.icon}</span>}
                valueStyle={{ fontSize: 26, color: m.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ════ Layer 2: Budget Health (only if budgets are set) ════ */}
      {ws && (ws.monthly_budget_cents > 0 || ws.daily_budget_cents > 0) && (
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col span={14}>
            <Card size="small" title="💰 预算健康" extra={
              <a onClick={() => navigate('/budget')}>预算控制 <ArrowRightOutlined /></a>
            }>
              <Row gutter={24}>
                {ws.monthly_budget_cents > 0 && (
                  <Col span={12}>
                    <Statistic title="月预算利用率" value={ws.monthly_percent} suffix="%"
                      valueStyle={{ fontSize: 20, color: ws.monthly_percent >= 85 ? '#ff4d4f' : '#1677ff' }} />
                    <Progress percent={Math.min(ws.monthly_percent, 100)}
                      strokeColor={budgetLevel(ws.monthly_spent_cents, ws.monthly_budget_cents)?.color}
                      status={budgetLevel(ws.monthly_spent_cents, ws.monthly_budget_cents)?.status} />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      ¥{yuan(ws.monthly_spent_cents)} / ¥{yuan(ws.monthly_budget_cents)}
                      {ws.forecast_days_remaining != null && (
                        <span> · 预计 {ws.forecast_days_remaining} 天后耗尽</span>
                      )}
                    </Typography.Text>
                  </Col>
                )}
                {ws.daily_budget_cents > 0 && (
                  <Col span={12}>
                    <Statistic title="日预算利用率" value={ws.daily_percent} suffix="%"
                      valueStyle={{ fontSize: 20, color: ws.daily_percent >= 85 ? '#ff4d4f' : '#1677ff' }} />
                    <Progress percent={Math.min(ws.daily_percent, 100)}
                      strokeColor={budgetLevel(ws.daily_spent_cents, ws.daily_budget_cents)?.color}
                      status={budgetLevel(ws.daily_spent_cents, ws.daily_budget_cents)?.status} />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      ¥{yuan(ws.daily_spent_cents)} / ¥{yuan(ws.daily_budget_cents)}
                    </Typography.Text>
                  </Col>
                )}
              </Row>
            </Card>
          </Col>
          <Col span={10}>
            <Card size="small" title={<><WarningOutlined /> 近期预算告警</>} extra={
              alerts.length > 0 ? <a onClick={() => navigate('/budget')}>查看全部</a> : null
            }>
              {alerts.length > 0 ? (
                <List size="small" dataSource={alerts.slice(0, 4)} renderItem={(a: any) => (
                  <List.Item style={{ padding: '2px 0' }}>
                    <Tag color={a.alert_type.includes('cutoff') ? 'red' : a.alert_type.includes('throttle') ? 'orange' : 'gold'}>
                      {a.threshold_percent}%
                    </Tag>
                    <Typography.Text style={{ fontSize: 12 }}>{a.alert_type.replace(/_/g, ' ')}</Typography.Text>
                  </List.Item>
                )} />
              ) : (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>暂无告警 ✅</Typography.Text>
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* ════ Layer 3: Trend Charts ════ */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={12}>
          <Card size="small" title="📈 近14天花费趋势" style={{ height: 340 }}>
            {trendData.length > 0 ? (
              <Line height={260} data={trendData} xField="date" yField="cost" smooth
                color="#cf1322" point={{ size: 2 }}
                area={{ style: { fill: 'l(270) 0:#ffffff 1:#ffccc7' } }}
                tooltip={{ items: [{ channel: 'y', name: '花费', valueFormatter: (v: number) => `¥${v.toFixed(2)}` }] }}
              />
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', paddingTop: 100 }}>暂无数据</Typography.Text>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="⚡ 近14天请求 & Token" style={{ height: 340 }}>
            {trendData.length > 0 ? (
              <Column height={260}
                data={trendData.flatMap((d: any) => [
                  { date: d.date, type: '请求数', value: d.requests },
                  { date: d.date, type: 'Token(K)', value: Math.round(d.tokens / 100) / 10 },
                ])}
                xField="date" yField="value" seriesField="type" isGroup
                color={['#1677ff', '#52c41a']}
                legend={{ position: 'top' }}
                xAxis={{ label: { autoRotate: true } }}
              />
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', paddingTop: 100 }}>暂无数据</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* ════ Layer 4: Composition & Health ════ */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card size="small" title="🏆 模型用量 TOP5" style={{ height: 340 }}>
            {(modelStats.breakdown || []).length > 0 ? (
              <Column height={260}
                data={(modelStats.breakdown || []).slice(0, 5).map((m: any) => ({
                  model: (m.name || 'unknown').length > 18 ? (m.name || 'unknown').substring(0, 18) + '...' : (m.name || 'unknown'),
                  tokens: Number(m.total_tokens || 0),
                }))}
                xField="model" yField="tokens" color="#1677ff"
                label={{ position: 'top', content: (d: any) => (d.tokens / 1000).toFixed(1) + 'K', style: { fontSize: 10 } }}
                xAxis={{ label: { autoRotate: true, style: { fontSize: 10 } } }}
              />
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', paddingTop: 100 }}>暂无调用数据</Typography.Text>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="🥧 Provider 花费占比" style={{ height: 340 }}>
            {(budget?.breakdown_by_model || []).filter((b: any) => b.cost_yuan > 0).length > 0 ? (
              <Pie height={260}
                data={(budget?.breakdown_by_model || []).filter((b: any) => b.cost_yuan > 0).map((b: any) => ({
                  type: b.name, value: Math.round(b.cost_yuan * 10000) / 10000,
                }))}
                angleField="value" colorField="type"
                radius={0.8} innerRadius={0.5}
                label={{ text: 'type', position: 'outside', style: { fontSize: 10 } }}
                legend={{ color: { position: 'bottom' } }}
                tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => `¥${v.toFixed(2)}` }] }}
                autoFit
              />
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', paddingTop: 100 }}>暂无花费数据</Typography.Text>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="💚 服务健康" style={{ height: 340 }}>
            {(() => {
              const totalReqs = trendData.reduce((s: number, d: any) => s + d.requests, 0);
              const successCount = (modelStats.breakdown || []).reduce((s: number, m: any) => s + Number(m.success_count || 0), 0);
              const errorCount = (modelStats.breakdown || []).reduce((s: number, m: any) => s + Number(m.error_count || 0), 0);
              const total = successCount + errorCount;
              const successRate = total > 0 ? Math.round(successCount / total * 10000) / 100 : 100;
              const avgLatency = (modelStats.breakdown || []).reduce((s: number, m: any, _: number, arr: any[]) => {
                return s + Number(m.avg_latency_ms || 0);
              }, 0) / Math.max((modelStats.breakdown || []).length, 1);

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <Typography.Text type="secondary">成功率</Typography.Text>
                    <div style={{ fontSize: 48, fontWeight: 700, color: successRate >= 99 ? '#52c41a' : successRate >= 95 ? '#faad14' : '#ff4d4f' }}>
                      {successRate}%
                    </div>
                    <Progress percent={Math.round(successRate)} showInfo={false}
                      strokeColor={successRate >= 99 ? '#52c41a' : successRate >= 95 ? '#faad14' : '#ff4d4f'} />
                  </div>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Statistic title={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> 成功</>}
                        value={successCount} valueStyle={{ fontSize: 20 }} />
                    </Col>
                    <Col span={12}>
                      <Statistic title={<><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 失败</>}
                        value={errorCount} valueStyle={{ fontSize: 20, color: errorCount > 0 ? '#ff4d4f' : undefined }} />
                    </Col>
                  </Row>
                  <div>
                    <Statistic title={<><ClockCircleOutlined /> 平均延迟</>}
                      value={Math.round(avgLatency)} suffix="ms" valueStyle={{ fontSize: 20 }} />
                  </div>
                </div>
              );
            })()}
          </Card>
        </Col>
      </Row>

      {/* ════ Layer 5: Live Feed ════ */}
      <Row gutter={16}>
        <Col span={12}>
          <Card size="small" title="🕐 最近操作" extra={
            <a onClick={() => navigate('/audit')}>审计日志 <ArrowRightOutlined /></a>
          }>
            {auditLogs.length > 0 ? (
              <List size="small" dataSource={auditLogs} renderItem={(a: any) => (
                <List.Item style={{ padding: '4px 0' }}>
                  <Space>
                    <Typography.Text type="secondary" style={{ fontSize: 11, width: 50 }}>
                      {a.created_at ? new Date(a.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Typography.Text>
                    <Tag color="default" style={{ fontSize: 10 }}>{a.action}</Tag>
                    <Typography.Text style={{ fontSize: 12, flex: 1 }} ellipsis>
                      {a.resource_type} {a.resource_id?.substring(0, 16)}...
                    </Typography.Text>
                  </Space>
                </List.Item>
              )} />
            ) : (
              <Typography.Text type="secondary">暂无操作记录</Typography.Text>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="📋 最近调用" extra={
            <a onClick={() => navigate('/logs')}>调用日志 <ArrowRightOutlined /></a>
          }>
            {requestLogs.length > 0 ? (
              <List size="small" dataSource={requestLogs} renderItem={(r: any) => (
                <List.Item style={{ padding: '4px 0' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space size={4}>
                      <Typography.Text type="secondary" style={{ fontSize: 11, width: 50 }}>
                        {r.created_at ? new Date(r.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Typography.Text>
                      <Tooltip title={r.action_label ? `操作: ${r.action_label}` : r.model}>
                        <code style={{ fontSize: 11 }}>{r.model}</code>
                      </Tooltip>
                    </Space>
                    <Space size={4}>
                      {Number(r.status) < 400 ? (
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                      ) : (
                        <Tooltip title={r.error_message || 'Request failed'}>
                          <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />
                        </Tooltip>
                      )}
                      <Tag color={Number(r.status) < 400 ? 'green' : 'red'} style={{ fontSize: 10 }}>
                        {r.status}
                      </Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {r.latency_ms}ms
                      </Typography.Text>
                    </Space>
                  </Space>
                </List.Item>
              )} />
            ) : (
              <Typography.Text type="secondary">暂无调用记录</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
