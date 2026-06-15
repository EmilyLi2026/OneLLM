import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Typography, Button, Spin, message, Select, DatePicker, Input, Space } from 'antd';
import {
  ThunderboltOutlined, DollarOutlined, ClockCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, OrderedListOutlined,
  ApiOutlined, SearchOutlined, ReloadOutlined, KeyOutlined,
} from '@ant-design/icons';
import { Line, Pie, Column } from '@ant-design/charts';
import { api, agentsAPI, keysAPI } from '../api/client';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const STATUS_OPTIONS = [
  { value: '200', label: '200 成功' },
  { value: '400', label: '4xx 客户端错误' },
  { value: '500', label: '5xx 服务端错误' },
];

export function LogsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [apiKeyStats, setApiKeyStats] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});

  // Filters
  const [dateRange, setDateRange] = useState<[any, any] | null>([dayjs().startOf('month'), dayjs()]);
  const [apiKeyFilter, setApiKeyFilter] = useState<string>('');
  const [modelFilter, setModelFilter] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Dropdown options
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [providerOptions, setProviderOptions] = useState<string[]>([]);
  const [agentOptions, setAgentOptions] = useState<{ id: string; name: string }[]>([]);
  const [keyOptions, setKeyOptions] = useState<{ id: string; name: string; key_prefix: string }[]>([]);

  // Load dropdowns
  useEffect(() => {
    api.get('/logs/filters').then(({ data }: any) => {
      setModelOptions(data.data.models || []);
      setProviderOptions(data.data.providers || []);
    }).catch(() => {});
    agentsAPI.list().then(({ data }: any) => {
      setAgentOptions((data.data || []).map((a: any) => ({ id: a.id, name: a.name })));
    }).catch(() => {});
    keysAPI.list().then(({ data }: any) => {
      setKeyOptions((data.data || []).map((k: any) => ({ id: k.id, name: k.name, key_prefix: k.key_prefix })));
    }).catch(() => {});
  }, []);

  // Build query params from filters
  const buildParams = useCallback(() => {
    const params: Record<string, any> = {};
    if (dateRange?.[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
    if (dateRange?.[1]) params.date_to = dateRange[1].format('YYYY-MM-DD 23:59:59');
    if (apiKeyFilter) params.api_key_id = apiKeyFilter;
    if (modelFilter) params.model = modelFilter;
    if (providerFilter) params.provider = providerFilter;
    if (agentFilter) params.agent_id = agentFilter;
    if (statusFilter) params.status = statusFilter;
    return params;
  }, [dateRange, apiKeyFilter, modelFilter, providerFilter, agentFilter, statusFilter]);

  const doFetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [trendRes, statsRes, apiKeyStatsRes] = await Promise.all([
        api.get('/logs/trend', { params }),
        api.get('/logs/stats', { params: { ...params, group_by: 'model' } }),
        api.get('/logs/stats', { params: { ...params, group_by: 'api_key' } }),
      ]);
      const trendData = (trendRes.data.data || []).map((d: any) => ({
        ...d,
        total_cost_yuan: Number(d.total_cost_cents) / 100,
        total_tokens: Number(d.total_tokens_in) + Number(d.total_tokens_out),
      }));
      const statsData = statsRes.data.data;
      const apiKeyStatsData = apiKeyStatsRes.data.data;
      setTrend(trendData);
      setStats(statsData.breakdown || []);
      setApiKeyStats(apiKeyStatsData.breakdown || []);

      const total = trendData.reduce((s: any, r: any) => ({
        tokens_in: s.tokens_in + Number(r.total_tokens_in),
        tokens_out: s.tokens_out + Number(r.total_tokens_out),
        cost: s.cost + Number(r.total_cost_cents),
        requests: s.requests + Number(r.total_requests),
        success: s.success + Number(r.success_count),
        error: s.error + Number(r.error_count),
        latency_sum: s.latency_sum + Number(r.avg_latency_ms) * Number(r.total_requests),
      }), { tokens_in: 0, tokens_out: 0, cost: 0, requests: 0, success: 0, error: 0, latency_sum: 0 });

      setSummary({
        ...total,
        tokens: total.tokens_in + total.tokens_out,
        avg_latency: total.requests > 0 ? Math.round(total.latency_sum / total.requests) : 0,
      });
    } catch { message.error('加载分析数据失败'); }
    finally { setLoading(false); }
  }, [buildParams]);

  useEffect(() => { doFetch(); }, []);

  // ── Data linking: when API Key changes, reload provider/model options ──
  useEffect(() => {
    if (apiKeyFilter) {
      api.get('/logs/filters', { params: { api_key_id: apiKeyFilter } })
        .then(({ data }: any) => {
          setModelOptions(data.data.models || []);
          setProviderOptions(data.data.providers || []);
        })
        .catch(() => {});
      // Clear potentially invalid selections
      setModelFilter('');
      setProviderFilter('');
    } else {
      // No key selected, restore all options
      api.get('/logs/filters')
        .then(({ data }: any) => {
          setModelOptions(data.data.models || []);
          setProviderOptions(data.data.providers || []);
        })
        .catch(() => {});
    }
  }, [apiKeyFilter]);

  const handleReset = () => {
    setDateRange([dayjs().startOf('month'), dayjs()]);
    setApiKeyFilter('');
    setModelFilter('');
    setProviderFilter('');
    setAgentFilter('');
    setStatusFilter('');
    setTimeout(doFetch, 0);
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          📊 调用分析
        </Typography.Title>
        <Button type="primary" icon={<OrderedListOutlined />} onClick={() => navigate('/logs/detail')}>
          查看详细日志
        </Button>
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
            value={apiKeyFilter || undefined}
            onChange={setApiKeyFilter}
            placeholder="选择 API Key"
            allowClear
            size="small"
            style={{ width: 200 }}
            options={keyOptions.map(k => ({ value: k.id, label: `${k.name} (${k.key_prefix}...)` }))}
          />
          <Select
            value={providerFilter || undefined}
            onChange={setProviderFilter}
            placeholder="选择 Provider"
            allowClear
            size="small"
            style={{ width: 140 }}
            options={providerOptions.filter(p => p !== 'unknown').map(p => ({ value: p, label: p }))}
          />
          <Select
            value={modelFilter || undefined}
            onChange={setModelFilter}
            placeholder="选择模型"
            allowClear
            size="small"
            style={{ width: 160 }}
            options={modelOptions.map(m => ({ value: m, label: m }))}
          />
          <Select
            value={agentFilter || undefined}
            onChange={setAgentFilter}
            placeholder="选择 Agent"
            allowClear
            size="small"
            style={{ width: 160 }}
            options={agentOptions.map(a => ({ value: a.id, label: a.name }))}
          />
          <Select
            value={statusFilter || undefined}
            onChange={setStatusFilter}
            placeholder="状态"
            allowClear
            size="small"
            style={{ width: 160 }}
            options={STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))}
          />
          <Button type="primary" icon={<SearchOutlined />} size="small" onClick={doFetch}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} size="small" onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总请求" value={summary.requests}
              valueStyle={{ fontSize: 22 }}
              suffix={
                <span style={{ fontSize: 12 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8, marginRight: 4 }} />
                  {summary.success}
                  <CloseCircleOutlined style={{ color: '#ff4d4f', marginLeft: 8, marginRight: 4 }} />
                  {summary.error}
                </span>
              } />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="输入 Token" value={summary.tokens_in?.toLocaleString()}
              prefix={<ApiOutlined />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="输出 Token" value={summary.tokens_out?.toLocaleString()}
              prefix={<ThunderboltOutlined />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总 Token" value={summary.tokens?.toLocaleString()}
              prefix={<ThunderboltOutlined />} valueStyle={{ fontSize: 22, color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="总花费" value={`¥${((summary.cost || 0) / 100).toFixed(2)}`}
              prefix={<DollarOutlined />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="平均延迟" value={summary.avg_latency}
              suffix="ms" prefix={<ClockCircleOutlined />} valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
      </Row>

      {/* Trend Charts — cost + tokens side by side */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="💰 每日花费趋势" size="small" style={{ height: 340 }}>
            {trend.length > 0 ? (
              <Line
                height={260}
                data={trend.map((d: any) => ({
                  date: d.date,
                  cost: Number(d.total_cost_cents) / 100,
                }))}
                xField="date"
                yField="cost"
                smooth
                color="#ff4d4f"
                point={{ size: 4 }}
                tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => `¥${v.toFixed(2)}` }] }}
              />
            ) : (
              <Typography.Text type="secondary">暂无数据</Typography.Text>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="⚡ 每日 Token 消耗" size="small" style={{ height: 340 }}>
            {trend.length > 0 ? (
              <Line
                height={260}
                data={trend.map((d: any) => ({
                  date: d.date,
                  tokens: Number(d.total_tokens_in) + Number(d.total_tokens_out),
                }))}
                xField="date"
                yField="tokens"
                smooth
                color="#1677ff"
                point={{ size: 4 }}
                tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => v.toLocaleString() }] }}
              />
            ) : (
              <Typography.Text type="secondary">暂无数据</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Composition + Comparison */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="🥧 模型用量占比" size="small" style={{ height: 420 }}>
            {(() => {
              const pieData = stats
                .filter((s: any) => Number(s.total_tokens) > 0)
                .map((s: any) => ({
                  type: s.name || 'unknown',
                  value: Number(s.total_tokens) || 0,
                }));
              if (pieData.length === 0) return <Typography.Text type="secondary">暂无数据</Typography.Text>;
              return (
                <Pie
                  height={300}
                  data={pieData}
                  angleField="value"
                  colorField="type"
                  radius={0.8}
                  innerRadius={0.6}
                  label={{ text: 'type', position: 'outside' }}
                  legend={{ color: { position: 'bottom' } }}
                  autoFit
                />
              );
            })()}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="📊 模型花费对比" size="small" style={{ height: 380 }}>
            {stats.length > 0 ? (
              <Column
                height={300}
                data={stats.map((s: any) => ({
                  model: s.name || 'unknown',
                  cost: Number(s.total_cost_cents) / 100,
                }))}
                xField="model"
                yField="cost"
                label={{ position: 'top', content: (d: any) => `¥${d.cost.toFixed(2)}` }}
                color="#1677ff"
                animation={{ appear: { animation: 'wave-in' } }}
                xAxis={{ label: { autoRotate: true } }}
              />
            ) : (
              <Typography.Text type="secondary">暂无数据</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* API Key breakdown */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="🔑 API Key 用量构成" size="small" style={{ height: 420 }}>
            {(() => {
              const pieData = apiKeyStats
                .filter((s: any) => Number(s.total_tokens) > 0)
                .map((s: any) => ({
                  type: s.name || 'unknown',
                  value: Number(s.total_tokens) || 0,
                }));
              if (pieData.length === 0) return <Typography.Text type="secondary">暂无数据</Typography.Text>;
              return (
                <Pie
                  height={300}
                  data={pieData}
                  angleField="value"
                  colorField="type"
                  radius={0.8}
                  innerRadius={0.6}
                  label={{ text: 'type', position: 'outside' }}
                  legend={{ color: { position: 'bottom' } }}
                  autoFit
                />
              );
            })()}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="💵 API Key 花费对比" size="small" style={{ height: 420 }}>
            {apiKeyStats.length > 0 ? (
              <Column
                height={300}
                data={apiKeyStats.map((s: any) => ({
                  key: s.name || 'unknown',
                  cost: Number(s.total_cost_cents) / 100,
                }))}
                xField="key"
                yField="cost"
                label={{ position: 'top', content: (d: any) => `¥${d.cost.toFixed(2)}` }}
                color="#fa8c16"
                animation={{ appear: { animation: 'wave-in' } }}
                xAxis={{ label: { autoRotate: true } }}
              />
            ) : (
              <Typography.Text type="secondary">暂无数据</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Token I/O + Request trend */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="⬆⬇ Token 输入/输出对比" size="small" style={{ height: 380 }}>
            {stats.length > 0 ? (
              <Column
                height={300}
                data={stats.flatMap((s: any) => [
                  { model: s.name || 'unknown', type: '输入', value: Number(s.total_tokens_in || 0) },
                  { model: s.name || 'unknown', type: '输出', value: Number(s.total_tokens_out || 0) },
                ])}
                xField="model"
                yField="value"
                seriesField="type"
                isGroup
                color={['#69b1ff', '#1677ff']}
                label={{ position: 'top' }}
                animation={{ appear: { animation: 'wave-in' } }}
                legend={{ position: 'top' }}
              />
            ) : (
              <Typography.Text type="secondary">暂无数据</Typography.Text>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="⏱ 请求量 & 成功率" size="small" style={{ height: 380 }}>
            {trend.length > 0 ? (
              <Column
                height={300}
                data={trend.map((d: any) => ({
                  date: d.date,
                  requests: Number(d.total_requests),
                  success: Number(d.success_count),
                  error: Number(d.error_count),
                })).flatMap((d: any) => [
                  { date: d.date, type: '成功', value: d.success },
                  { date: d.date, type: '失败', value: d.error },
                ])}
                xField="date"
                yField="value"
                seriesField="type"
                isStack
                color={['#52c41a', '#ff4d4f']}
                animation={{ appear: { animation: 'wave-in' } }}
                legend={{ position: 'top' }}
              />
            ) : (
              <Typography.Text type="secondary">暂无数据</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
