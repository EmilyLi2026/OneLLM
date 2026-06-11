import { useState } from 'react';
import {
  Card, DatePicker, Button, Typography, Tag, Descriptions, Table,
  Collapse, Alert, Spin, Empty, Space, Row, Col, Divider, Statistic,
  Tooltip,
} from 'antd';
import {
  SafetyCertificateOutlined, FileProtectOutlined, PrinterOutlined,
  CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
  ReloadOutlined, ExportOutlined, UserOutlined, KeyOutlined,
  AuditOutlined, CloudServerOutlined, DollarOutlined,
  AlertOutlined, BugOutlined, BulbOutlined,
  HomeOutlined, GlobalOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

// ── Types ──

interface ComplianceReport {
  meta: ReportMeta;
  access_control: any;
  audit_trail: any;
  data_flow: any;
  budget_control: any;
  security_events: any;
  model_governance: any;
  recommendations: any[];
}

interface ReportMeta {
  workspace_name: string;
  period_from: string;
  period_to: string;
  generated_at: string;
  rating: 'green' | 'yellow' | 'red';
  summary: Record<string, number>;
}

// ── Rating config ──

const RATING_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  green:  { color: '#52c41a', icon: <CheckCircleOutlined />, label: '良好' },
  yellow: { color: '#faad14', icon: <WarningOutlined />,     label: '需关注' },
  red:    { color: '#ff4d4f', icon: <CloseCircleOutlined />, label: '存在风险' },
};

// ── Ref (for auto-scroll) ──
let reportRef: HTMLDivElement | null = null;

export function CompliancePage() {
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().startOf('month'),
    dayjs(),
  ]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!dates) return;
    setLoading(true);
    setError('');
    setReport(null);

    try {
      const from = dates[0].format('YYYY-MM-DD');
      const to = dates[1].format('YYYY-MM-DD');
      const { data: res } = await api.get('/compliance/report', { params: { from, to } });
      if (res.status === 'success') {
        setReport(res.data);
        // Scroll to report after a short delay for render
        setTimeout(() => {
          reportRef?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      } else {
        setError(res.message || '生成失败');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  // ── Print: open clean report in new window ──
  const handlePrint = () => {
    if (!report) return;
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) return;
    printWin.document.write(buildPrintHTML(report));
    printWin.document.close();
    printWin.focus();
    // Print after fonts/styles load
    printWin.onload = () => setTimeout(() => printWin.print(), 300);
    setTimeout(() => printWin.print(), 500);
  };

  return (
    <div className="compliance-page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          <SafetyCertificateOutlined style={{ marginRight: 10, color: '#1677ff' }} />
          合规中心
        </Title>
        <Text type="secondary">生成工作区的合规审计报告，覆盖访问控制、数据流向、安全事件、模型治理等维度。</Text>
      </div>

      {/* ── Controls ── */}
      <Card size="small" style={{ marginBottom: 24 }}>
        <Space wrap>
          <RangePicker
            value={dates as any}
            onChange={(vals) => setDates(vals as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            disabledDate={(d) => d.isAfter(dayjs())}
            allowClear={false}
            style={{ width: 260 }}
          />
          <Button
            type="primary"
            icon={<FileProtectOutlined />}
            onClick={generate}
            loading={loading}
            disabled={!dates}
          >
            生成报告
          </Button>
          {report && (
            <>
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>
                打印报告
              </Button>
              <Button icon={<ReloadOutlined />} onClick={generate} loading={loading}>
                重新生成
              </Button>
            </>
          )}
        </Space>
        <Text type="secondary" style={{ marginLeft: 16, fontSize: 12 }}>
          报告周期最长 90 天
        </Text>
      </Card>

      {/* ── Error ── */}
      {error && (
        <Alert type="error" message={error} closable style={{ marginBottom: 24 }} onClose={() => setError('')} />
      )}

      {/* ── Loading ── */}
      {loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <Paragraph type="secondary" style={{ marginTop: 16 }}>
              正在生成合规报告，正在分析数据...
            </Paragraph>
            <div style={{ maxWidth: 400, margin: '16px auto' }}>
              {['汇总工作区信息', '分析访问控制', '整理审计记录', '统计数据流向', '检查预算状态', '评估安全事件', '生成改进建议'].map((step, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                  color: '#bbb', fontSize: 13,
                }}>
                  <Spin size="small" /> {step}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Empty state ── */}
      {!loading && !report && !error && (
        <Card>
          <Empty
            image={<FileProtectOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
            description="选择报告周期后点击「生成报告」"
          />
        </Card>
      )}

      {/* ═══════════════════ REPORT ═══════════════════ */}
      {report && (
        <div ref={(el) => { reportRef = el; }}>
          <ReportContent report={report} />
        </div>
      )}
    </div>
  );
}

// ── Report Content ──

function ReportContent({ report }: { report: ComplianceReport }) {
  const { meta, access_control, audit_trail, data_flow, budget_control, security_events, model_governance, recommendations } = report;
  const rating = RATING_CONFIG[meta.rating] || RATING_CONFIG.green;

  return (
    <div className="compliance-report" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      {/* ── Report Header ── */}
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="top">
          <Col>
            <Title level={4} className="print-keep" style={{ marginBottom: 4 }}>
              <FileProtectOutlined style={{ marginRight: 8 }} />
              AI Hub 合规报告
            </Title>
            <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
              <Descriptions.Item label="工作区">{meta.workspace_name}</Descriptions.Item>
              <Descriptions.Item label="报告周期">{meta.period_from} ~ {meta.period_to}</Descriptions.Item>
              <Descriptions.Item label="生成时间">{dayjs(meta.generated_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="合规评级">
                <Tag color={rating.color} icon={rating.icon}>{rating.label}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col>
            <Row gutter={[24, 16]}>
              <Col><Statistic title="活跃用户" value={meta.summary.active_users} prefix={<UserOutlined />} /></Col>
              <Col><Statistic title="API 调用" value={meta.summary.total_requests?.toLocaleString()} prefix={<CloudServerOutlined />} /></Col>
              <Col><Statistic title="审计事件" value={meta.summary.audit_events} prefix={<AuditOutlined />} /></Col>
              <Col><Statistic title="预算违规" value={meta.summary.budget_violations} prefix={<DollarOutlined />} valueStyle={meta.summary.budget_violations > 0 ? { color: '#ff4d4f' } : undefined} /></Col>
            </Row>
          </Col>
        </Row>
        {meta.summary.cross_border_requests > 0 && (
          <Alert
            type="warning"
            message={`检测到 ${meta.summary.cross_border_requests} 次境外模型调用，涉及数据出境风险`}
            style={{ marginTop: 12 }}
            showIcon
          />
        )}
      </Card>

      {/* ── Section cards ── */}
      <Collapse
        defaultActiveKey={['access', 'dataflow', 'budget']}
        style={{ background: '#fff' }}
        items={[
          { key: 'access', label: <SectionLabel icon={<UserOutlined />} title="访问控制现状" badge={`${access_control.members.length} 人 · ${access_control.api_keys.length} Keys`} />, children: <AccessControlSection data={access_control} /> },
          { key: 'audit', label: <SectionLabel icon={<AuditOutlined />} title="操作审计追踪" badge={`${audit_trail.total_events} 条记录`} />, children: <AuditTrailSection data={audit_trail} /> },
          { key: 'dataflow', label: <SectionLabel icon={<GlobalOutlined />} title="模型调用数据流向" badge={`${data_flow.by_provider.length} 家厂商`} />, children: <DataFlowSection data={data_flow} /> },
          { key: 'budget', label: <SectionLabel icon={<DollarOutlined />} title="预算与成本管控" badge={budget_control.monthly_status ? `已用 ${budget_control.monthly_status.percent}%` : '未设置'} />, children: <BudgetControlSection data={budget_control} /> },
          { key: 'security', label: <SectionLabel icon={<AlertOutlined />} title="安全事件记录" badge={`${security_events.notable_events.length} 起`} />, children: <SecurityEventsSection data={security_events} /> },
          { key: 'models', label: <SectionLabel icon={<CloudServerOutlined />} title="模型风险分级" badge={`${model_governance.active_models.length} 个模型`} />, children: <ModelGovernanceSection data={model_governance} /> },
          { key: 'recs', label: <SectionLabel icon={<BulbOutlined />} title="改进建议" badge={`${recommendations.length} 条`} />, children: <RecommendationsSection data={recommendations} /> },
        ]}
      />
    </div>
  );
}

// ── Section header ──

function SectionLabel({ icon, title, badge }: { icon: React.ReactNode; title: string; badge: string }) {
  return (
    <Space>
      {icon}
      <Text strong>{title}</Text>
      <Tag style={{ marginLeft: 8 }}>{badge}</Tag>
    </Space>
  );
}

// ── 1. Access Control ──

function AccessControlSection({ data }: { data: any }) {
  return (
    <div>
      <Title level={5}>成员与角色</Title>
      <Table
        dataSource={data.members}
        rowKey="user_name"
        pagination={false}
        size="small"
        columns={[
          { title: '用户', dataIndex: 'user_name', key: 'user_name' },
          { title: '手机号', dataIndex: 'user_phone', key: 'user_phone', render: (v: string) => v || '—' },
          {
            title: '角色', dataIndex: 'role', key: 'role',
            render: (v: string) => {
              const colors: Record<string, string> = { owner: 'red', admin: 'orange', member: 'blue', viewer: 'default' };
              return <Tag color={colors[v] || 'default'}>{v}</Tag>;
            },
          },
          { title: '加入时间', dataIndex: 'joined_at', key: 'joined_at', render: (v: string) => v?.slice(0, 10) },
        ]}
      />

      <Title level={5} style={{ marginTop: 24 }}>API Key 清单</Title>
      <Table
        dataSource={data.api_keys}
        rowKey={(r: any) => r.key_preview}
        pagination={false}
        size="small"
        columns={[
          { title: '名称', dataIndex: 'name', key: 'name' },
          { title: '类型', dataIndex: 'key_type', key: 'key_type', render: (v: string) => v === 'agent_key' ? <Tag color="purple">Agent</Tag> : <Tag>API</Tag> },
          { title: 'Key', dataIndex: 'key_preview', key: 'key_preview', render: (v: string) => <Text code>{v}...</Text> },
          { title: '状态', dataIndex: 'revoked', key: 'revoked', render: (v: boolean) => v ? <Tag color="red">已吊销</Tag> : <Tag color="green">活跃</Tag> },
          { title: '绑定数', dataIndex: 'binding_count', key: 'binding_count' },
          { title: '最后使用', dataIndex: 'last_used_at', key: 'last_used_at', render: (v: string) => v ? v.slice(0, 10) : '从未使用' },
        ]}
      />

      {data.role_changes.length > 0 && (
        <>
          <Title level={5} style={{ marginTop: 24 }}>权限变更记录</Title>
          {data.role_changes.map((e: any, i: number) => (
            <div key={i} style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>
              <Text code style={{ fontSize: 12 }}>{e.timestamp?.slice(0, 19).replace('T', ' ')}</Text>
              {' '}{e.user_name} — {e.action_label}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── 2. Audit Trail ──

function AuditTrailSection({ data }: { data: any }) {
  return (
    <div>
      <Row gutter={24}>
        <Col span={12}>
          <Title level={5}>操作类型分布</Title>
          <Table
            dataSource={data.action_distribution}
            rowKey="action"
            pagination={false}
            size="small"
            columns={[
              { title: '操作', dataIndex: 'action_label', key: 'action_label' },
              { title: '次数', dataIndex: 'count', key: 'count', align: 'right' as const },
            ]}
          />
        </Col>
        <Col span={12}>
          <Title level={5}>近期操作时间线（最近 50 条）</Title>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {data.timeline.length === 0 && <Text type="secondary">报告期内无审计记录</Text>}
            {data.timeline.map((e: any, i: number) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>{e.timestamp?.slice(0, 19).replace('T', ' ')}</Text>
                <br />
                <Text strong>{e.user_name}</Text>
                {' '}<Tag style={{ fontSize: 11 }}>{e.action_label}</Tag>
                {e.ip_address && <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>IP: {e.ip_address}</Text>}
              </div>
            ))}
          </div>
        </Col>
      </Row>
    </div>
  );
}

// ── 3. Data Flow ──

function DataFlowSection({ data }: { data: any }) {
  return (
    <div>
      {data.cross_border && (
        <Alert
          type="warning"
          message={`⚠️ 数据出境风险：${data.cross_border.provider_count} 家境外厂商被调用 ${data.cross_border.request_count} 次`}
          description={data.cross_border.suggestion}
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      <Title level={5}>按厂商分布</Title>
      <Table
        dataSource={data.by_provider}
        rowKey="provider"
        pagination={false}
        size="small"
        columns={[
          { title: '厂商', dataIndex: 'provider_name_cn', key: 'provider_name_cn', render: (v: string, r: any) => v || r.provider },
          {
            title: '地区', dataIndex: 'region', key: 'region',
            render: (v: string) => v === 'china' ? <Tag color="green">🇨🇳 中国</Tag> : <Tag color="orange">🌐 境外</Tag>,
          },
          { title: '请求数', dataIndex: 'request_count', key: 'request_count', render: (v: number) => v.toLocaleString(), align: 'right' as const },
          { title: 'Token 输入', dataIndex: 'tokens_in', key: 'tokens_in', render: (v: number) => v.toLocaleString(), align: 'right' as const },
          { title: 'Token 输出', dataIndex: 'tokens_out', key: 'tokens_out', render: (v: number) => v.toLocaleString(), align: 'right' as const },
          { title: '费用', dataIndex: 'cost_yuan', key: 'cost_yuan', render: (v: string) => `¥${v}`, align: 'right' as const },
        ]}
      />

      {data.by_agent.length > 0 && (
        <>
          <Title level={5} style={{ marginTop: 24 }}>按 Agent 分布</Title>
          <Table
            dataSource={data.by_agent}
            rowKey="agent_id"
            pagination={false}
            size="small"
            columns={[
              { title: 'Agent', dataIndex: 'agent_name', key: 'agent_name' },
              { title: '请求数', dataIndex: 'request_count', key: 'request_count', render: (v: number) => v.toLocaleString(), align: 'right' as const },
              {
                title: '调用厂商', dataIndex: 'providers', key: 'providers',
                render: (providers: string[]) => (
                  <Space size={4} wrap>
                    {providers.map(p => <Tag key={p} style={{ fontSize: 11 }}>{p}</Tag>)}
                  </Space>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}

// ── 4. Budget Control ──

function BudgetControlSection({ data }: { data: any }) {
  return (
    <div>
      <Row gutter={24}>
        <Col span={12}>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Workspace 月预算">
              {Number(data.workspace_monthly_budget_yuan) > 0 ? `¥${data.workspace_monthly_budget_yuan}` : <Tag>未设置</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Workspace 日预算">
              {Number(data.workspace_daily_budget_yuan) > 0 ? `¥${data.workspace_daily_budget_yuan}` : <Tag>未设置</Tag>}
            </Descriptions.Item>
          </Descriptions>
        </Col>
        <Col span={12}>
          {data.monthly_status ? (
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="月预算额">¥{data.monthly_status.budgeted_yuan}</Descriptions.Item>
              <Descriptions.Item label="本月已用">¥{data.monthly_status.spent_yuan}</Descriptions.Item>
              <Descriptions.Item label="使用率">
                <Tag color={data.monthly_status.level === 'cutoff' ? 'red' : data.monthly_status.level === 'throttle' ? 'orange' : data.monthly_status.level === 'warning' ? 'gold' : 'green'}>
                  {data.monthly_status.percent}%
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Alert type="info" message="未设置 Workspace 月预算" description="建议设置预算上限以防止账单失控。" showIcon />
          )}
        </Col>
      </Row>

      {data.violations.length > 0 && (
        <>
          <Title level={5} style={{ marginTop: 24 }}>预算违规记录</Title>
          <Table
            dataSource={data.violations}
            rowKey={(_r: any, i?: number) => `violation-${i ?? 0}`}
            pagination={false}
            size="small"
            columns={[
              { title: '类型', dataIndex: 'alert_type', key: 'alert_type' },
              { title: '阈值', dataIndex: 'threshold_percent', key: 'threshold_percent', render: (v: number) => `${v}%` },
              { title: '触发时间', dataIndex: 'notified_at', key: 'notified_at', render: (v: string) => v?.slice(0, 19).replace('T', ' ') },
            ]}
          />
        </>
      )}

      {data.cost_trend.length > 0 && (
        <>
          <Title level={5} style={{ marginTop: 24 }}>成本趋势（按日）</Title>
          <Table
            dataSource={data.cost_trend}
            rowKey="period"
            pagination={false}
            size="small"
            columns={[
              { title: '日期', dataIndex: 'period', key: 'period' },
              { title: '请求数', dataIndex: 'request_count', key: 'request_count', render: (v: number) => v.toLocaleString(), align: 'right' as const },
              { title: '费用', dataIndex: 'cost_yuan', key: 'cost_yuan', render: (v: string) => `¥${v}`, align: 'right' as const },
            ]}
          />
        </>
      )}
    </div>
  );
}

// ── 5. Security Events ──

function SecurityEventsSection({ data }: { data: any }) {
  return (
    <div>
      <Row gutter={24}>
        <Col span={12}>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Key 吊销">{data.key_revocations} 次</Descriptions.Item>
            <Descriptions.Item label="预算熔断">{data.budget_cutoffs} 次</Descriptions.Item>
            <Descriptions.Item label="认证失败">暂未采集</Descriptions.Item>
            <Descriptions.Item label="无效 Key 拦截">暂未采集</Descriptions.Item>
            <Descriptions.Item label="限流触发">暂未采集</Descriptions.Item>
            <Descriptions.Item label="Provider 故障切换">暂未采集</Descriptions.Item>
          </Descriptions>
        </Col>
        <Col span={12}>
          <Title level={5}>需关注的事件</Title>
          {data.notable_events.length === 0 && <Text type="secondary">报告期内无异常事件</Text>}
          {data.notable_events.map((e: any, i: number) => (
            <Alert
              key={i}
              type={e.severity === 'high' ? 'error' : e.severity === 'medium' ? 'warning' : 'info'}
              message={`${e.timestamp?.slice(0, 19).replace('T', ' ')} — ${e.description}`}
              style={{ marginBottom: 8 }}
              showIcon
            />
          ))}
        </Col>
      </Row>
    </div>
  );
}

// ── 6. Model Governance ──

function ModelGovernanceSection({ data }: { data: any }) {
  return (
    <div>
      <Title level={5}>活跃模型清单</Title>
      <Table
        dataSource={data.active_models}
        rowKey="model"
        pagination={false}
        size="small"
        columns={[
          { title: '模型名称', dataIndex: 'model_name', key: 'model_name' },
          { title: '模型 ID', dataIndex: 'model', key: 'model', render: (v: string) => <Text code>{v}</Text> },
          { title: '厂商', dataIndex: 'provider_name_cn', key: 'provider_name_cn', render: (v: string, r: any) => v || r.provider },
          {
            title: '地区', dataIndex: 'region', key: 'region',
            render: (v: string) => v === 'china' ? <Tag color="green">境内</Tag> : <Tag color="orange">境外</Tag>,
          },
          { title: '能力', dataIndex: 'capability', key: 'capability', render: (v: string) => <Tag>{v}</Tag> },
          {
            title: '风险等级', dataIndex: 'risk_level', key: 'risk_level',
            render: (v: string) => {
              const m: Record<string, { color: string; text: string }> = {
                low: { color: 'green', text: '低' },
                medium: { color: 'gold', text: '中' },
                high: { color: 'orange', text: '高' },
                critical: { color: 'red', text: '极高' },
              };
              const c = m[v] || { color: 'default', text: v };
              return <Tag color={c.color}>{c.text}</Tag>;
            },
          },
          { title: '调用次数', dataIndex: 'request_count', key: 'request_count', render: (v: number) => v.toLocaleString(), align: 'right' as const },
        ]}
      />

      <Title level={5} style={{ marginTop: 24 }}>按能力分类</Title>
      <Table
        dataSource={data.by_capability}
        rowKey="capability"
        pagination={false}
        size="small"
        columns={[
          { title: '能力类型', dataIndex: 'capability', key: 'capability', render: (v: string) => <Tag>{v}</Tag> },
          { title: '调用次数', dataIndex: 'request_count', key: 'request_count', render: (v: number) => v.toLocaleString(), align: 'right' as const },
          {
            title: '含境外调用', dataIndex: 'has_cross_border', key: 'has_cross_border',
            render: (v: boolean) => v ? <WarningOutlined style={{ color: '#faad14' }} /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />,
            align: 'center' as const,
          },
        ]}
      />
    </div>
  );
}

// ── 7. Recommendations ──

function RecommendationsSection({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <Empty description="未发现合规差距" />;
  }

  return (
    <div>
      {data.map((rec: any, i: number) => {
        const colorMap: Record<string, string> = { high: '#ff4d4f', medium: '#faad14', low: '#52c41a' };
        return (
          <Alert
            key={i}
            type={rec.priority === 'high' ? 'error' : rec.priority === 'medium' ? 'warning' : 'info'}
            message={
              <Space>
                <Tag color={colorMap[rec.priority]}>{rec.priority === 'high' ? '高' : rec.priority === 'medium' ? '中' : '低'}</Tag>
                <Text strong>{rec.title}</Text>
                <Tag>{rec.category}</Tag>
              </Space>
            }
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>{rec.detail}</Paragraph>
                <Text type="secondary">💡 {rec.suggestion}</Text>
              </div>
            }
            style={{ marginBottom: 12 }}
            showIcon
          />
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// Print — standalone clean HTML report in new window
// ══════════════════════════════════════════════════════

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildPrintHTML(r: ComplianceReport): string {
  const { meta, access_control, audit_trail, data_flow, budget_control, security_events, model_governance, recommendations } = r;
  const ratingCfg: Record<string, string> = { green: '🟢 良好', yellow: '🟡 需关注', red: '🔴 存在风险' };

  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<title>AI Hub 合规报告</title>\n' +
'<style>\n' +
'  * { margin:0;padding:0;box-sizing:border-box; }\n' +
'  body { font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:13px;color:#222;line-height:1.6;padding:28px 32px; }\n' +
'  h1 { font-size:22px;margin-bottom:4px; }\n' +
'  h2 { font-size:16px;color:#1677ff;border-bottom:2px solid #1677ff;padding-bottom:4px;margin:26px 0 10px;page-break-after:avoid; }\n' +
'  h3 { font-size:14px;margin:14px 0 8px; }\n' +
'  .meta { display:flex;gap:28px;flex-wrap:wrap;margin:10px 0 14px;font-size:13px;color:#555; }\n' +
'  .stat-row { display:flex;gap:20px;flex-wrap:wrap;margin:6px 0 14px; }\n' +
'  .stat { text-align:center;min-width:70px; }\n' +
'  .stat .val { font-size:20px;font-weight:700;color:#1677ff; }\n' +
'  .stat .lbl { font-size:11px;color:#888; }\n' +
'  .box { padding:10px 14px;margin:10px 0;font-size:12px;border-radius:4px; }\n' +
'  .box-warn { background:#fff7e6;border:1px solid #ffd591;border-left:4px solid #faad14; }\n' +
'  .box-err { background:#fff1f0;border:1px solid #ffa39e;border-left:4px solid #ff4d4f; }\n' +
'  .box-ok { background:#f6ffed;border:1px solid #b7eb8f;border-left:4px solid #52c41a; }\n' +
'  table { width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:12px;page-break-inside:avoid; }\n' +
'  th { background:#f5f5f5;font-weight:600;text-align:left;padding:7px 9px;border:1px solid #ddd; }\n' +
'  td { padding:5px 9px;border:1px solid #eee; }\n' +
'  tr:nth-child(even) td { background:#fafafa; }\n' +
'  .num { text-align:right; }\n' +
'  .tag { display:inline-block;padding:1px 7px;border-radius:3px;font-size:11px; }\n' +
'  .tg-g { background:#f6ffed;color:#389e0d;border:1px solid #b7eb8f; }\n' +
'  .tg-y { background:#fffbe6;color:#d48806;border:1px solid #ffe58f; }\n' +
'  .tg-o { background:#fff7e6;color:#d46b08;border:1px solid #ffd591; }\n' +
'  .tg-r { background:#fff1f0;color:#cf1322;border:1px solid #ffa39e; }\n' +
'  .tg-b { background:#e6f7ff;color:#096dd9;border:1px solid #91d5ff; }\n' +
'  .rec { margin-bottom:10px;padding:10px 14px;border-radius:6px;border-left:4px solid #ddd;background:#fafafa; }\n' +
'  .rec-h { border-left-color:#ff4d4f;background:#fff1f0; }\n' +
'  .rec-m { border-left-color:#faad14;background:#fff7e6; }\n' +
'  .rec-l { border-left-color:#52c41a;background:#f6ffed; }\n' +
'  .rec-t { font-weight:600;margin-bottom:4px; }\n' +
'  .rec-d { font-size:12px;color:#555;margin-bottom:4px; }\n' +
'  .rec-s { font-size:12px;color:#1677ff; }\n' +
'  @page { size:A4;margin:12mm 10mm; }\n' +
'  @media print { body { padding:0; } }\n' +
'</style>\n</head>\n<body>\n' +

'<h1>AI Hub 合规报告</h1>\n' +
'<div class="meta">\n' +
'  <span>工作区：' + esc(meta.workspace_name) + '</span>\n' +
'  <span>报告周期：' + esc(meta.period_from) + ' ~ ' + esc(meta.period_to) + '</span>\n' +
'  <span>生成时间：' + esc(new Date(meta.generated_at).toLocaleString('zh-CN')) + '</span>\n' +
'  <span>合规评级：' + (ratingCfg[meta.rating] || meta.rating) + '</span>\n' +
'</div>\n' +

'<div class="stat-row">\n' +
'  <div class="stat"><div class="val">' + meta.summary.active_users + '</div><div class="lbl">活跃用户</div></div>\n' +
'  <div class="stat"><div class="val">' + (meta.summary.total_requests ?? 0).toLocaleString() + '</div><div class="lbl">API 调用</div></div>\n' +
'  <div class="stat"><div class="val">' + meta.summary.audit_events + '</div><div class="lbl">审计事件</div></div>\n' +
'  <div class="stat"><div class="val">' + meta.summary.budget_violations + '</div><div class="lbl">预算违规</div></div>\n' +
'  <div class="stat"><div class="val">' + (meta.summary.cross_border_requests ?? 0) + '</div><div class="lbl">境外调用</div></div>\n' +
'</div>\n' +

(meta.summary.cross_border_requests > 0
  ? '<div class="box box-warn"><strong>⚠ 数据出境风险：</strong>报告期内有 ' + meta.summary.cross_border_requests + ' 次境外模型调用，详见「模型调用数据流向」章节。</div>\n'
  : '') +

// 1. Access Control
'<h2>1. 访问控制现状</h2>\n' +
'<h3>成员与角色</h3>\n' +
'<table><tr><th>用户</th><th>手机号</th><th>角色</th><th>加入时间</th></tr>\n' +
(access_control.members.length === 0
  ? '<tr><td colspan="4" style="color:#999;text-align:center">报告期内无成员数据</td></tr>\n'
  : access_control.members.map((m: any) =>
      '<tr><td>' + esc(m.user_name) + '</td><td>' + (esc(m.user_phone) || '—') + '</td><td>' + esc(m.role) + '</td><td>' + esc((m.joined_at || '').slice(0, 10)) + '</td></tr>'
    ).join('\n')) +
'</table>\n' +

'<h3>API Key 清单</h3>\n' +
'<table><tr><th>名称</th><th>类型</th><th>预览</th><th>状态</th><th>绑定数</th><th>最后使用</th></tr>\n' +
(access_control.api_keys.length === 0
  ? '<tr><td colspan="6" style="color:#999;text-align:center">无 API Key</td></tr>\n'
  : access_control.api_keys.map((k: any) =>
      '<tr><td>' + esc(k.name) + '</td><td>' + (k.key_type === 'agent_key' ? 'Agent Key' : 'API Key') + '</td><td><code>' + esc(k.key_preview) + '...</code></td><td>' +
      (k.revoked ? '<span class="tag tg-r">已吊销</span>' : '<span class="tag tg-g">活跃</span>') +
      '</td><td class="num">' + k.binding_count + '</td><td>' + (k.last_used_at ? esc(k.last_used_at.slice(0, 10)) : '从未使用') + '</td></tr>'
    ).join('\n')) +
'</table>\n' +

// 2. Audit
'<h2>2. 操作审计追踪</h2>\n' +
'<p style="color:#888;margin-bottom:6px">共 ' + audit_trail.total_events + ' 条审计记录（以下为最近 50 条）</p>\n' +
'<table><tr><th>时间</th><th>用户</th><th>操作</th><th>对象类型</th><th>IP</th></tr>\n' +
(audit_trail.timeline.length === 0
  ? '<tr><td colspan="5" style="color:#999;text-align:center">报告期内无审计记录</td></tr>\n'
  : audit_trail.timeline.map((e: any) =>
      '<tr><td>' + esc((e.timestamp || '').slice(0, 19).replace('T', ' ')) + '</td><td>' + esc(e.user_name) + '</td><td>' + esc(e.action_label) + '</td><td>' + esc(e.resource_type) + '</td><td>' + (esc(e.ip_address) || '—') + '</td></tr>'
    ).join('\n')) +
'</table>\n' +

// 3. Data Flow
'<h2>3. 模型调用数据流向</h2>\n' +
(data_flow.cross_border
  ? '<div class="box box-warn"><strong>⚠ 数据出境检测：</strong>' + esc(data_flow.cross_border.suggestion) + '</div>\n'
  : '') +

'<h3>按厂商分布</h3>\n' +
'<table><tr><th>厂商</th><th>地区</th><th class="num">请求数</th><th class="num">Token 输入</th><th class="num">Token 输出</th><th class="num">费用 (¥)</th></tr>\n' +
(data_flow.by_provider.length === 0
  ? '<tr><td colspan="6" style="color:#999;text-align:center">报告期内无调用记录</td></tr>\n'
  : data_flow.by_provider.map((p: any) =>
      '<tr><td>' + esc(p.provider_name_cn || p.provider) + '</td><td>' + (p.region === 'china' ? '🇨🇳 境内' : '🌐 境外') + '</td><td class="num">' + (p.request_count || 0).toLocaleString() + '</td><td class="num">' + (p.tokens_in || 0).toLocaleString() + '</td><td class="num">' + (p.tokens_out || 0).toLocaleString() + '</td><td class="num">' + esc(p.cost_yuan) + '</td></tr>'
    ).join('\n')) +
'</table>\n' +

(data_flow.by_agent.length > 0
  ? '<h3>按 Agent 分布</h3>\n<table><tr><th>Agent</th><th class="num">请求数</th><th>调用厂商</th></tr>\n' +
    data_flow.by_agent.map((a: any) =>
      '<tr><td>' + esc(a.agent_name) + '</td><td class="num">' + (a.request_count || 0).toLocaleString() + '</td><td>' + (a.providers || []).map((p: string) => '<span class="tag tg-b">' + esc(p) + '</span>').join(' ') + '</td></tr>'
    ).join('\n') + '\n</table>\n'
  : '') +

// 4. Budget
'<h2>4. 预算与成本管控</h2>\n' +
'<table><tr><th>项目</th><th>配置</th></tr>\n' +
'<tr><td>Workspace 月预算</td><td>' + (Number(budget_control.workspace_monthly_budget_yuan) > 0 ? '¥' + esc(budget_control.workspace_monthly_budget_yuan) : '<span class="tag tg-y">未设置</span>') + '</td></tr>\n' +
'<tr><td>Workspace 日预算</td><td>' + (Number(budget_control.workspace_daily_budget_yuan) > 0 ? '¥' + esc(budget_control.workspace_daily_budget_yuan) : '<span class="tag tg-y">未设置</span>') + '</td></tr>\n' +
(budget_control.monthly_status
  ? '<tr><td>本月使用率</td><td>' + esc(String(budget_control.monthly_status.percent)) + '%（已用 ¥' + esc(budget_control.monthly_status.spent_yuan) + ' / 预算 ¥' + esc(budget_control.monthly_status.budgeted_yuan) + '）</td></tr>\n'
  : '') +
'</table>\n' +

(budget_control.violations.length > 0
  ? '<h3>预算违规记录</h3>\n<table><tr><th>类型</th><th>阈值</th><th>触发时间</th></tr>\n' +
    budget_control.violations.map((v: any) =>
      '<tr><td>' + esc(v.alert_type) + '</td><td>' + v.threshold_percent + '%</td><td>' + esc((v.notified_at || '').slice(0, 19).replace('T', ' ')) + '</td></tr>'
    ).join('\n') + '\n</table>\n'
  : '<div class="box box-ok">✅ 报告期内无预算违规事件</div>\n') +

'<h3>成本趋势（按日）</h3>\n' +
'<table><tr><th>日期</th><th class="num">请求数</th><th class="num">费用 (¥)</th></tr>\n' +
(budget_control.cost_trend.length === 0
  ? '<tr><td colspan="3" style="color:#999;text-align:center">无数据</td></tr>\n'
  : budget_control.cost_trend.map((c: any) =>
      '<tr><td>' + esc(c.period) + '</td><td class="num">' + (c.request_count || 0).toLocaleString() + '</td><td class="num">' + esc(c.cost_yuan) + '</td></tr>'
    ).join('\n')) +
'</table>\n' +

// 5. Security Events
'<h2>5. 安全事件记录</h2>\n' +
'<table><tr><th>事件类型</th><th class="num">次数</th><th>说明</th></tr>\n' +
'<tr><td>Key 吊销</td><td class="num">' + security_events.key_revocations + '</td><td>' + (security_events.key_revocations > 0 ? '需关注' : '—') + '</td></tr>\n' +
'<tr><td>预算熔断</td><td class="num">' + security_events.budget_cutoffs + '</td><td>' + (security_events.budget_cutoffs > 0 ? '⚠ 超预算触发硬熔断' : '—') + '</td></tr>\n' +
'<tr><td>认证失败</td><td class="num">—</td><td>暂未采集（建议启用登录审计）</td></tr>\n' +
'<tr><td>Provider 故障切换</td><td class="num">—</td><td>暂未采集</td></tr>\n' +
'</table>\n' +

(security_events.notable_events.length > 0
  ? '<h3>需关注事件</h3>\n' +
    security_events.notable_events.map((e: any) =>
      '<div class="box ' + (e.severity === 'high' ? 'box-err' : e.severity === 'medium' ? 'box-warn' : 'box-ok') + '"><strong>' + esc((e.timestamp || '').slice(0, 19).replace('T', ' ')) + '</strong> — ' + esc(e.description) + '</div>'
    ).join('\n') + '\n'
  : '') +

// 6. Model Governance
'<h2>6. 模型风险分级</h2>\n' +
'<table><tr><th>模型名称</th><th>模型 ID</th><th>厂商</th><th>地区</th><th>能力</th><th>风险等级</th><th class="num">调用次数</th></tr>\n' +
(model_governance.active_models.length === 0
  ? '<tr><td colspan="7" style="color:#999;text-align:center">报告期内无模型调用记录</td></tr>\n'
  : model_governance.active_models.map((m: any) => {
      const rt: Record<string, string> = { low: '<span class="tag tg-g">低</span>', medium: '<span class="tag tg-y">中</span>', high: '<span class="tag tg-o">高</span>', critical: '<span class="tag tg-r">极高</span>' };
      return '<tr><td>' + esc(m.model_name) + '</td><td><code>' + esc(m.model) + '</code></td><td>' + esc(m.provider_name_cn || m.provider) + '</td><td>' + (m.region === 'china' ? '境内' : '境外') + '</td><td>' + esc(m.capability) + '</td><td>' + (rt[m.risk_level] || m.risk_level) + '</td><td class="num">' + (m.request_count || 0).toLocaleString() + '</td></tr>';
    }).join('\n')) +
'</table>\n' +

'<h3>按能力分类</h3>\n' +
'<table><tr><th>能力类型</th><th class="num">调用次数</th><th>含境外调用</th></tr>\n' +
(model_governance.by_capability.length === 0
  ? '<tr><td colspan="3" style="color:#999;text-align:center">无数据</td></tr>\n'
  : model_governance.by_capability.map((c: any) =>
      '<tr><td>' + esc(c.capability) + '</td><td class="num">' + (c.request_count || 0).toLocaleString() + '</td><td>' + (c.has_cross_border ? '<span class="tag tg-y">⚠ 是</span>' : '<span class="tag tg-g">否</span>') + '</td></tr>'
    ).join('\n')) +
'</table>\n' +

// 7. Recommendations
'<h2>7. 改进建议</h2>\n' +
(recommendations.length === 0
  ? '<div class="box box-ok">✅ 未发现明显合规差距。</div>\n'
  : recommendations.map((rec: any) =>
      '<div class="rec rec-' + rec.priority.charAt(0) + '">\n' +
      '  <div class="rec-t"><span class="tag tg-' + (rec.priority === 'high' ? 'r' : rec.priority === 'medium' ? 'y' : 'g') + '">' + (rec.priority === 'high' ? '高优先' : rec.priority === 'medium' ? '中优先' : '低优先') + '</span> ' + esc(rec.title) + ' <span class="tag tg-b">' + esc(rec.category) + '</span></div>\n' +
      '  <div class="rec-d">' + esc(rec.detail) + '</div>\n' +
      '  <div class="rec-s">💡 ' + esc(rec.suggestion) + '</div>\n' +
      '</div>'
    ).join('\n')) +

'<p style="text-align:center;color:#bbb;margin-top:36px;font-size:11px">— AI Hub 合规报告 · 由系统自动生成 · ' + new Date().toLocaleString('zh-CN') + ' —</p>\n' +
'</body>\n</html>';
}
