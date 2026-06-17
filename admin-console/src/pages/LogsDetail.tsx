import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Tag, Select, DatePicker, Input, Button, Space, Typography,
  Card, Row, Col, Statistic, message, Tooltip,
} from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import type { TablePaginationConfig } from 'antd/es/table';
import {
  SearchOutlined, ReloadOutlined, FilterOutlined, ArrowLeftOutlined,
  ThunderboltOutlined, DollarOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, KeyOutlined,
} from '@ant-design/icons';
import { logsAPI, agentsAPI, keysAPI, api } from '../api/client';
import { formatCost } from '../utils/format';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const STATUS_OPTIONS = [
  { value: '200', label: '200 成功' },
  { value: '400', label: '4xx 客户端错误' },
  { value: '500', label: '5xx 服务端错误' },
];

// Fields that support server-side sorting
const SORTABLE_FIELDS = ['created_at', 'tokens_in', 'tokens_out', 'cost_cents', 'latency_ms'];

export function LogsDetailPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});

  // Pagination + Sort
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');

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

  // Load filter options on mount
  useEffect(() => {
    agentsAPI.list().then(({ data }) => {
      setAgentOptions((data.data || []).map((a: any) => ({ id: a.id, name: a.name })));
    }).catch(() => {});

    api.get('/logs/filters').then(({ data }: any) => {
      setModelOptions(data.data.models || []);
      setProviderOptions(data.data.providers || []);
    }).catch(() => {});

    keysAPI.list().then(({ data }: any) => {
      setKeyOptions((data.data || []).map((k: any) => ({ id: k.id, name: k.name, key_prefix: k.key_prefix })));
    }).catch(() => {});
  }, []);

  // Unified fetch: builds params from current state, calls API, updates all results
  const doFetch = useCallback((
    pageOverride?: number,
    pageSizeOverride?: number,
    sortFieldOverride?: string,
    sortOrderOverride?: 'DESC' | 'ASC',
  ) => {
    setLoading(true);
    const p = pageOverride ?? page;
    const ps = pageSizeOverride ?? pageSize;
    const sf = sortFieldOverride ?? sortField;
    const so = sortOrderOverride ?? sortOrder;

    const params: Record<string, any> = {
      page: p,
      limit: ps,
      sort_field: sf,
      sort_order: so,
    };
    if (dateRange?.[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
    if (dateRange?.[1]) params.date_to = dateRange[1].format('YYYY-MM-DD 23:59:59');
    if (apiKeyFilter) params.api_key_id = apiKeyFilter;
    if (modelFilter) params.model = modelFilter;
    if (providerFilter) params.provider = providerFilter;
    if (agentFilter) params.agent_id = agentFilter;
    if (statusFilter) params.status = statusFilter;

    logsAPI.query(params).then(({ data }) => {
      setLogs(data.data.logs || []);
      setTotal(data.data.pagination.total);
      setSummary(data.data.summary || {});
    }).catch((err: any) => {
      message.error(err.response?.data?.message || '加载日志失败');
    }).finally(() => setLoading(false));
  }, [page, pageSize, sortField, sortOrder, dateRange, apiKeyFilter, modelFilter, providerFilter, agentFilter, statusFilter]);

  // Initial load
  useEffect(() => { doFetch(1); }, []);

  // ── Data linking: when API Key changes, reload provider/model options ──
  useEffect(() => {
    if (apiKeyFilter) {
      api.get('/logs/filters', { params: { api_key_id: apiKeyFilter } })
        .then(({ data }: any) => {
          setModelOptions(data.data.models || []);
          setProviderOptions(data.data.providers || []);
        })
        .catch(() => {});
      setModelFilter('');
      setProviderFilter('');
    } else {
      api.get('/logs/filters')
        .then(({ data }: any) => {
          setModelOptions(data.data.models || []);
          setProviderOptions(data.data.providers || []);
        })
        .catch(() => {});
    }
  }, [apiKeyFilter]);

  // Handle table onChange: pagination + sorting
  const handleTableChange = (
    pag: TablePaginationConfig,
    _filters: any,
    sorter: SorterResult<any> | SorterResult<any>[],
  ) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const newPage = pag.current ?? page;
    const newPageSize = pag.pageSize ?? pageSize;

    let newSortField = sortField;
    let newSortOrder = sortOrder;
    if (s.order) {
      const field = s.field as string;
      if (SORTABLE_FIELDS.includes(field)) {
        newSortField = field;
        newSortOrder = s.order === 'ascend' ? 'ASC' : 'DESC';
      }
    }

    // Update state first, then fetch
    setPage(newPage);
    setPageSize(newPageSize);
    if (newSortField !== sortField || newSortOrder !== sortOrder) {
      setSortField(newSortField);
      setSortOrder(newSortOrder);
    }

    // Use the new values directly (don't wait for state update)
    doFetch(newPage, newPageSize, newSortField, newSortOrder);
  };

  const handleQuery = () => {
    setPage(1);
    doFetch(1, pageSize, sortField, sortOrder);
  };

  const handleReset = () => {
    setDateRange([dayjs().startOf('month'), dayjs()]);
    setApiKeyFilter('');
    setModelFilter('');
    setProviderFilter('');
    setAgentFilter('');
    setStatusFilter('');
    setSortField('created_at');
    setSortOrder('DESC');
    setPage(1);
    // Use overrides directly to avoid stale state
    const params: Record<string, any> = { page: 1, limit: pageSize, sort_field: 'created_at', sort_order: 'DESC' };
    setLoading(true);
    logsAPI.query(params).then(({ data }) => {
      setLogs(data.data.logs || []);
      setTotal(data.data.pagination.total);
      setSummary(data.data.summary || {});
    }).catch(() => {}).finally(() => setLoading(false));
  };

  // Build column sortOrder from current state
  const getSortOrder = (field: string) =>
    sortField === field ? (sortOrder === 'ASC' ? 'ascend' as const : 'descend' as const) : undefined;

  const columns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm:ss') : '-',
      sorter: true,
      sortOrder: getSortOrder('created_at') },
    { title: 'API Key', dataIndex: 'api_key_name', key: 'api_key_name', width: 140,
      render: (v: string, record: any) => v
        ? <Tooltip title={`${v} (${record.api_key_prefix || ''}…)`}><Tag color="green">{v.length > 16 ? v.substring(0, 16) + '…' : v}</Tag></Tooltip>
        : (record.api_key_id ? <Tag color="default">{record.api_key_id.substring(0, 14)}…</Tag> : '-') },
    { title: 'Provider', dataIndex: 'provider', key: 'provider', width: 100,
      render: (v: string) => <Tag color={v === 'unknown' ? 'default' : 'blue'}>{v}</Tag> },
    { title: '模型', dataIndex: 'model', key: 'model', width: 140,
      render: (v: string) => <Tag>{v}</Tag> },
    { title: '执行流程', dataIndex: 'agent_role', key: 'agent_role', width: 140,
      render: (v: string) => v
        ? <Tooltip title={v}><Tag color="geekblue">{v.length > 18 ? v.substring(0, 18) + '…' : v}</Tag></Tooltip>
        : '-' },
    { title: '执行任务', dataIndex: 'action_label', key: 'action_label', width: 180,
      render: (v: string) => v
        ? <Tooltip title={v}><Typography.Text style={{ fontSize: 12 }}>{v.length > 28 ? v.substring(0, 28) + '…' : v}</Typography.Text></Tooltip>
        : '-' },
    { title: 'Token In', dataIndex: 'tokens_in', key: 'tokens_in', width: 90,
      render: (v: number) => v?.toLocaleString(),
      sorter: true,
      sortOrder: getSortOrder('tokens_in') },
    { title: 'Token Out', dataIndex: 'tokens_out', key: 'tokens_out', width: 90,
      render: (v: number) => v?.toLocaleString(),
      sorter: true,
      sortOrder: getSortOrder('tokens_out') },
    { title: '花费', dataIndex: 'cost_cents', key: 'cost_cents', width: 90,
      render: (v: number) => formatCost(v || 0, 4),
      sorter: true,
      sortOrder: getSortOrder('cost_cents') },
    { title: '延迟', dataIndex: 'latency_ms', key: 'latency_ms', width: 80,
      render: (v: number) => `${v || 0}ms`,
      sorter: true,
      sortOrder: getSortOrder('latency_ms') },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: number) => (
        <Tag color={s < 300 ? 'green' : s < 400 ? 'orange' : 'red'}>
          {s}
        </Tag>
      ) },
    { title: 'Agent', dataIndex: 'agent_id', key: 'agent', width: 100,
      render: (v: string) => v ? <Tag color="purple">{v.substring(0, 15)}...</Tag> : '-' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/logs')} style={{ marginRight: 8 }}>
          返回分析
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <FilterOutlined style={{ marginRight: 8 }} />
          调用日志详情
        </Typography.Title>
      </div>

      {/* Stats summary */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col flex="1">
          <Card size="small" hoverable>
            <Statistic title="总请求" value={summary.total_requests || 0}
              valueStyle={{ fontSize: 20 }}
              suffix={
                <span style={{ fontSize: 13 }}>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                  {summary.success_count || 0}
                  <CloseCircleOutlined style={{ color: '#ff4d4f', marginLeft: 12, marginRight: 4 }} />
                  {summary.error_count || 0}
                </span>
              } />
          </Card>
        </Col>
        <Col flex="1">
          <Card size="small" hoverable>
            <Statistic title="输入 Token" value={summary.total_tokens_in?.toLocaleString() || 0}
              valueStyle={{ fontSize: 18 }} />
          </Card>
        </Col>
        <Col flex="1">
          <Card size="small" hoverable>
            <Statistic title="输出 Token" value={summary.total_tokens_out?.toLocaleString() || 0}
              valueStyle={{ fontSize: 18 }} />
          </Card>
        </Col>
        <Col flex="1">
          <Card size="small" hoverable>
            <Statistic title="总 Token" value={summary.total_tokens?.toLocaleString() || 0}
              prefix={<ThunderboltOutlined />} valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col flex="1">
          <Card size="small" hoverable>
            <Statistic title="总花费" value={`¥${summary.total_cost_yuan || '0.00'}`}
              prefix="¥" valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col flex="1">
          <Card size="small" hoverable>
            <Statistic title="平均延迟" value={summary.avg_latency_ms || 0}
              suffix="ms" prefix={<ClockCircleOutlined />} valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

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
          <Button type="primary" icon={<SearchOutlined />} size="small" onClick={handleQuery}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} size="small" onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Table
        dataSource={logs}
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        onChange={handleTableChange}
        scroll={{ x: 1500 }}
        locale={{ emptyText: '暂无日志数据' }}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showTotal: (t, range) => `共 ${t} 条，当前 ${range[0]}-${range[1]}`,
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
      />
    </div>
  );
}
