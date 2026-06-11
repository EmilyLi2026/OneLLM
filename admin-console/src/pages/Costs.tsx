import { useEffect, useState, useCallback } from 'react';
import { Row, Col, Card, Statistic, Typography, Button, Spin, message, Select, DatePicker, Space, Table, Segmented } from 'antd';
import {
  DollarOutlined, ThunderboltOutlined, CalendarOutlined,
  ApiOutlined, BarChartOutlined, PieChartOutlined,
  SearchOutlined, ReloadOutlined, RiseOutlined, FallOutlined,
} from '@ant-design/icons';
import { Line, Pie, Column } from '@ant-design/charts';
import { api } from '../api/client';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const GROUP_OPTIONS = [
  { value: 'model', label: '按模型' },
  { value: 'provider', label: '按 Provider' },
  { value: 'agent', label: '按 Agent' },
];

export function CostsPage() {
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});

  // Filters
  const [dateRange, setDateRange] = useState<[any, any] | null>([dayjs().startOf('month'), dayjs()]);
  const [modelFilter, setModelFilter] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [groupBy, setGroupBy] = useState<string>('model');

  // Dropdown options
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [providerOptions, setProviderOptions] = useState<string[]>([]);
  const [agentOptions, setAgentOptions] = useState<{ id: string; name: string }[]>([]);

  // Load dropdowns
  useEffect(() => {
    api.get('/logs/filters').then(({ data }: any) => {
      setModelOptions(data.data.models || []);
      setProviderOptions(data.data.providers || []);
    }).catch(() => {});
    api.get('/agents').then(({ data }: any) => {
      setAgentOptions((data.data || []).map((a: any) => ({ id: a.id, name: a.name })));
    }).catch(() => {});
  }, []);

  const buildParams = useCallback(() => {
    const params: Record<string, any> = {};
    if (dateRange?.[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
    if (dateRange?.[1]) params.date_to = dateRange[1].format('YYYY-MM-DD 23:59:59');
    if (modelFilter) params.model = modelFilter;
    if (providerFilter) params.provider = providerFilter;
    if (agentFilter) params.agent_id = agentFilter;
    return params;
  }, [dateRange, modelFilter, providerFilter, agentFilter]);

  const doFetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [trendRes, statsRes] = await Promise.all([
        api.get('/logs/trend', { params }),
        api.get('/logs/stats', { params: { ...params, group_by: groupBy } }),
      ]);

      // Trend data
      const trendData = (trendRes.data.data || []).map((d: any) => ({
        date: d.date,
        cost: Number(d.total_cost_cents) / 100,
        tokens: Number(d.total_tokens_in) + Number(d.total_tokens_out),
        requests: Number(d.total_requests),
        avg_cost_per_req: Number(d.total_requests) > 0
          ? Number(d.total_cost_cents) / 100 / Number(d.total_requests) : 0,
      }));
      setTrend(trendData);

      // Breakdown
      const bd = (statsRes.data.data?.breakdown || []).map((b: any) => ({
        ...b,
        cost_yuan: Number(b.total_cost_cents) / 100,
        tokens: Number(b.total_tokens_in) + Number(b.total_tokens_out),
        avg_cost_per_req: Number(b.total_requests) > 0
          ? Number(b.total_cost_cents) / 100 / Number(b.total_requests) : 0,
        avg_cost_per_1k_tokens: Number(b.total_tokens) > 0
          ? Number(b.total_cost_cents) / 100 / (Number(b.total_tokens) / 1000) : 0,
      }));
      setBreakdown(bd);

      // Summary
      const total = trendData.reduce((s: any, r: any) => ({
        cost: s.cost + r.cost,
        tokens: s.tokens + r.tokens,
        requests: s.requests + r.requests,
      }), { cost: 0, tokens: 0, requests: 0 });

      const days = trendData.length || 1;
      setSummary({
        total_cost: total.cost,
        total_tokens: total.tokens,
        total_requests: total.requests,
        avg_daily_cost: total.cost / days,
        avg_cost_per_req: total.requests > 0 ? total.cost / total.requests : 0,
        avg_cost_per_1k_tokens: total.tokens > 0
          ? total.cost / (total.tokens / 1000) : 0,
        unique_dims: bd.length,
      });
    } catch { message.error('加载成本数据失败'); }
    finally { setLoading(false); }
  }, [buildParams, groupBy]);

  useEffect(() => { doFetch(); }, [doFetch]);

  const handleReset = () => {
    setDateRange([dayjs().startOf('month'), dayjs()]);
    setModelFilter('');
    setProviderFilter('');
    setAgentFilter('');
    setGroupBy('model');
  };

  // Compute cost change indicator (today vs yesterday)
  const costTrend = trend.length >= 2
    ? ((trend[trend.length - 1].cost - trend[trend.length - 2].cost) / (trend[trend.length - 2].cost || 0.01) * 100)
    : 0;

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          💰 成本分析
        </Typography.Title>
        <Segmented
          value={groupBy}
          onChange={(v) => setGroupBy(v as string)}
          options={GROUP_OPTIONS}
        />
      </div>

      {/* Filter bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size={[12, 12]} style={{ width: '100%' }}>
          <RangePicker
            value={dateRange as any}
            onChange={(dates: any) => setDateRange(dates)}
            placeholder={['开始日期', '结束日期']}
            size="small"
            style={{ width: 250 }}
          />
          <Select
            value={modelFilter || undefined}
            onChange={setModelFilter}
            placeholder="选择模型"
            allowClear size="small"
            style={{ width: 160 }}
            options={modelOptions.map(m => ({ value: m, label: m }))}
          />
          <Select
            value={providerFilter || undefined}
            onChange={setProviderFilter}
            placeholder="选择 Provider"
            allowClear size="small"
            style={{ width: 140 }}
            options={providerOptions.filter(p => p !== 'unknown').map(p => ({ value: p, label: p }))}
          />
          <Select
            value={agentFilter || undefined}
            onChange={setAgentFilter}
            placeholder="选择 Agent"
            allowClear size="small"
            style={{ width: 160 }}
            options={agentOptions.map(a => ({ value: a.id, label: a.name }))}
          />
          <Button type="primary" icon={<SearchOutlined />} size="small" onClick={doFetch}>查询</Button>
          <Button icon={<ReloadOutlined />} size="small" onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总花费" value={`¥${summary.total_cost?.toFixed(2)}`}
              prefix={<DollarOutlined />}
              valueStyle={{ fontSize: 22, color: '#cf1322' }}
              suffix={
                trend.length >= 2 ? (
                  <span style={{ fontSize: 12, color: costTrend > 0 ? '#cf1322' : '#3f8600' }}>
                    {costTrend > 0 ? <RiseOutlined /> : <FallOutlined />}
                    {Math.abs(costTrend).toFixed(1)}%
                  </span>
                ) : undefined
              }
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="日均花费" value={`¥${summary.avg_daily_cost?.toFixed(2)}`}
              prefix={<CalendarOutlined />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总 Token" value={summary.total_tokens?.toLocaleString()}
              prefix={<ThunderboltOutlined />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总请求" value={summary.total_requests?.toLocaleString()}
              prefix={<ApiOutlined />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="每次请求成本" value={`¥${summary.avg_cost_per_req?.toFixed(4)}`}
              prefix={<BarChartOutlined />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="千Token成本" value={`¥${summary.avg_cost_per_1k_tokens?.toFixed(3)}`}
              prefix={<PieChartOutlined />} valueStyle={{ fontSize: 22, color: '#1677ff' }} />
          </Card>
        </Col>
      </Row>

      {/* Charts Row 1: Daily cost trend + Cost pie by dimension */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={14}>
          <Card title="📈 每日花费趋势" size="small" style={{ height: 380 }}>
            {trend.length > 0 ? (
              <Line
                height={300}
                data={trend}
                xField="date"
                yField="cost"
                smooth
                color="#cf1322"
                point={{ size: 3 }}
                area={{
                  style: { fill: 'l(270) 0:#ffffff 1:#ffccc7' },
                }}
                tooltip={{
                  items: [
                    { channel: 'y', name: '花费', valueFormatter: (v: number) => `¥${v.toFixed(2)}` },
                  ],
                }}
              />
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', paddingTop: 120 }}>
                暂无数据
              </Typography.Text>
            )}
          </Card>
        </Col>
        <Col span={10}>
          <Card title={`🥧 花费占比 (${GROUP_OPTIONS.find(g => g.value === groupBy)?.label})`} size="small" style={{ height: 380 }}>
            {breakdown.filter((b: any) => b.cost_yuan > 0).length > 0 ? (
              <Pie
                height={300}
                data={breakdown
                  .filter((b: any) => b.cost_yuan > 0)
                  .map((b: any) => ({ type: b.name || 'unknown', value: Math.round(b.cost_yuan * 10000) / 10000 }))}
                angleField="value"
                colorField="type"
                radius={0.8}
                innerRadius={0.55}
                label={{
                  text: 'type',
                  position: 'outside',
                  style: { fontSize: 11 },
                }}
                legend={{ color: { position: 'bottom', layout: { justifyContent: 'center' } } }}
                statistic={{
                  title: false,
                  content: {
                    style: { fontSize: 14 },
                    customHtml: (_: any, _v: any, data: any[]) => {
                      const total = data.reduce((s, d) => s + d.value, 0);
                      return `<div style="text-align:center"><div style="font-size:20px;font-weight:bold">¥${total.toFixed(2)}</div><div style="font-size:11px;color:#999">总计</div></div>`;
                    },
                  },
                }}
                tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => `¥${v.toFixed(2)}` }] }}
                autoFit
              />
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', paddingTop: 120 }}>
                暂无数据
              </Typography.Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2: Cost bar by dimension + Cost vs Tokens scatter/dual */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title={`📊 花费对比 (${GROUP_OPTIONS.find(g => g.value === groupBy)?.label})`} size="small" style={{ height: 380 }}>
            {breakdown.length > 0 ? (
              <Column
                height={300}
                data={breakdown
                  .filter((b: any) => b.cost_yuan > 0)
                  .sort((a: any, b: any) => b.cost_yuan - a.cost_yuan)
                  .slice(0, 15)
                  .map((b: any) => ({
                    name: (b.name || 'unknown').length > 20
                      ? (b.name || 'unknown').substring(0, 20) + '...' : (b.name || 'unknown'),
                    cost: Math.round(b.cost_yuan * 100) / 100,
                  }))}
                xField="name"
                yField="cost"
                color="#fa8c16"
                label={{ position: 'top', content: (d: any) => `¥${d.cost.toFixed(2)}`, style: { fontSize: 10 } }}
                xAxis={{ label: { autoRotate: true, style: { fontSize: 10 } } }}
                animation={{ appear: { animation: 'wave-in' } }}
              />
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', paddingTop: 120 }}>
                暂无数据
              </Typography.Text>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="⚡ Token 消耗 & 请求量趋势" size="small" style={{ height: 380 }}>
            {trend.length > 0 ? (
              <Column
                height={300}
                data={trend.flatMap((d: any) => [
                  { date: d.date, type: 'Token(K)', value: Math.round(d.tokens / 100) / 10 },
                  { date: d.date, type: '请求数', value: d.requests },
                ])}
                xField="date"
                yField="value"
                seriesField="type"
                isGroup
                color={['#1677ff', '#52c41a']}
                legend={{ position: 'top' }}
                xAxis={{ label: { autoRotate: true } }}
                animation={{ appear: { animation: 'wave-in' } }}
              />
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', paddingTop: 120 }}>
                暂无数据
              </Typography.Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Detailed breakdown table */}
      <Card title="📋 详细成本明细" size="small">
        <Table
          dataSource={breakdown}
          rowKey="name"
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 项` }}
          scroll={{ x: 800 }}
          columns={[
            {
              title: GROUP_OPTIONS.find(g => g.value === groupBy)?.label?.replace('按', '') || '维度',
              dataIndex: 'name',
              key: 'name',
              width: 180,
              render: (v: string) => v || 'unknown',
            },
            {
              title: '花费', dataIndex: 'cost_yuan', key: 'cost',
              width: 120,
              sorter: (a: any, b: any) => a.cost_yuan - b.cost_yuan,
              render: (v: number) => <span style={{ color: '#cf1322', fontWeight: 500 }}>¥{v.toFixed(4)}</span>,
            },
            {
              title: '花费占比', dataIndex: 'cost_yuan', key: 'cost_pct',
              width: 100,
              render: (v: number) => {
                const total = breakdown.reduce((s: number, b: any) => s + b.cost_yuan, 0);
                const pct = total > 0 ? (v / total * 100).toFixed(1) : '0';
                return `${pct}%`;
              },
            },
            {
              title: '总 Token', dataIndex: 'tokens', key: 'tokens',
              width: 130,
              sorter: (a: any, b: any) => a.tokens - b.tokens,
              render: (v: number) => v?.toLocaleString(),
            },
            {
              title: '输入 Token', dataIndex: 'total_tokens_in', key: 'tokens_in',
              width: 130,
              sorter: (a: any, b: any) => Number(a.total_tokens_in) - Number(b.total_tokens_in),
              render: (v: any) => Number(v).toLocaleString(),
            },
            {
              title: '输出 Token', dataIndex: 'total_tokens_out', key: 'tokens_out',
              width: 130,
              sorter: (a: any, b: any) => Number(a.total_tokens_out) - Number(b.total_tokens_out),
              render: (v: any) => Number(v).toLocaleString(),
            },
            {
              title: '请求数', dataIndex: 'total_requests', key: 'requests',
              width: 100,
              sorter: (a: any, b: any) => Number(a.total_requests) - Number(b.total_requests),
              render: (v: any) => Number(v).toLocaleString(),
            },
            {
              title: '成功 / 失败', dataIndex: 'total_requests', key: 'success_rate',
              width: 130,
              render: (_: any, r: any) => {
                const s = Number(r.success_count || 0);
                const e = Number(r.error_count || 0);
                return (
                  <span>
                    <span style={{ color: '#52c41a' }}>{s}</span>
                    {' / '}
                    <span style={{ color: e > 0 ? '#ff4d4f' : '#999' }}>{e}</span>
                  </span>
                );
              },
            },
            {
              title: '千Token成本', dataIndex: 'avg_cost_per_1k_tokens', key: 'cpt',
              width: 120,
              sorter: (a: any, b: any) => a.avg_cost_per_1k_tokens - b.avg_cost_per_1k_tokens,
              render: (v: number) => v > 0 ? `¥${v.toFixed(3)}` : '-',
            },
            {
              title: '平均延迟', dataIndex: 'avg_latency_ms', key: 'latency',
              width: 100,
              sorter: (a: any, b: any) => Number(a.avg_latency_ms) - Number(b.avg_latency_ms),
              render: (v: any) => `${Math.round(Number(v))}ms`,
            },
          ]}
          locale={{ emptyText: '暂无成本数据，产生 API 调用后自动统计' }}
        />
      </Card>
    </div>
  );
}
