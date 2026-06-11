import { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Tag, Spin, Card, Space, Select, DatePicker, Input,
  Drawer, Descriptions, Button, Row, Col,
} from 'antd';
import {
  AuditOutlined, SearchOutlined, FilterOutlined, EyeOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import dayjs from 'dayjs';

const ACTION_COLORS: Record<string, string> = {
  '创建': 'green', '添加': 'blue', '更新': 'orange',
  '删除': 'red', '吊销': 'red', '解绑': 'red',
  '绑定': 'cyan', '加入': 'purple', '邀请': 'geekblue',
};

function actionColor(label: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (label.includes(key)) return color;
  }
  return 'default';
}

const { RangePicker } = DatePicker;

export function AuditPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().startOf('month'), dayjs(),
  ]);

  // Options
  const [actionOptions, setActionOptions] = useState<{ value: string; label: string; count: number }[]>([]);
  const [typeOptions, setTypeOptions] = useState<{ value: string; label: string; count: number }[]>([]);

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLog, setDetailLog] = useState<any>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { limit: pageSize, offset: (page - 1) * pageSize };
      if (actionFilter) params.action = actionFilter;
      if (typeFilter) params.resource_type = typeFilter;
      if (searchText) params.search = searchText;
      if (dateRange?.[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
      if (dateRange?.[1]) params.date_to = dateRange[1].format('YYYY-MM-DD');

      const { data } = await api.get('/audit', { params });
      setLogs(data.data.logs || []);
      setTotal(data.data.total || 0);
      if (data.data.filter_options) {
        setActionOptions(data.data.filter_options.actions || []);
        setTypeOptions(data.data.filter_options.resource_types || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, pageSize, actionFilter, typeFilter, searchText, dateRange]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const openDetail = (log: any) => {
    setDetailLog(log);
    setDetailOpen(true);
  };

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        <AuditOutlined style={{ marginRight: 8 }} />审计日志
      </Typography.Title>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <FilterOutlined style={{ marginRight: 4, color: '#888' }} />
          </Col>
          <Col>
            <RangePicker
              value={dateRange as any}
              onChange={(dates) => { setDateRange(dates as any); setPage(1); }}
              placeholder={['开始日期', '结束日期']}
              style={{ width: 240 }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              allowClear
              placeholder="操作类型"
              style={{ width: 160 }}
              value={actionFilter || undefined}
              onChange={(v) => { setActionFilter(v || ''); setPage(1); }}
              options={actionOptions.map(o => ({
                value: o.value,
                label: `${o.label} (${o.count})`,
              }))}
            />
          </Col>
          <Col>
            <Select
              allowClear
              placeholder="资源类型"
              style={{ width: 140 }}
              value={typeFilter || undefined}
              onChange={(v) => { setTypeFilter(v || ''); setPage(1); }}
              options={typeOptions.map(o => ({
                value: o.value,
                label: `${o.label} (${o.count})`,
              }))}
            />
          </Col>
          <Col flex="auto">
            <Input
              allowClear
              placeholder="搜索操作人、操作..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={() => { setPage(1); fetchLogs(); }}
              style={{ maxWidth: 250 }}
            />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Table
        dataSource={logs} rowKey="id" size="small"
        loading={loading}
        columns={[
          {
            title: '时间', dataIndex: 'created_at', width: 160,
            render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
          },
          {
            title: '操作', dataIndex: 'action_label', width: 130,
            render: (label: string) => (
              <Tag color={actionColor(label || '')}>{label}</Tag>
            ),
          },
          {
            title: '资源', key: 'resource', width: 200, ellipsis: true,
            render: (_: any, r: any) => (
              <Space size={4}>
                <Tag color="default" style={{ fontSize: 11 }}>{r.resource_type}</Tag>
                {r.resource_name ? (
                  <Typography.Text style={{ fontSize: 12 }}>{r.resource_name}</Typography.Text>
                ) : (
                  <Typography.Text code style={{ fontSize: 11 }}>
                    {r.resource_id?.substring(0, 12)}...
                  </Typography.Text>
                )}
              </Space>
            ),
          },
          {
            title: '操作人', key: 'user', width: 130,
            render: (_: any, r: any) => (
              <Space size={4}>
                <Typography.Text strong style={{ fontSize: 13 }}>
                  {r.user_name || (r.user_phone ? r.user_phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '-')}
                </Typography.Text>
              </Space>
            ),
          },
          {
            title: '摘要', dataIndex: 'details', width: 220, ellipsis: true,
            render: (d: any) => {
              if (!d || Object.keys(d).length === 0) return <Typography.Text type="secondary">-</Typography.Text>;
              const entries = Object.entries(d);
              if (entries.length === 0) return <Typography.Text type="secondary">-</Typography.Text>;
              return (
                <Space size={2} wrap>
                  {entries.slice(0, 3).map(([k, v]) => (
                    <Tag key={k} style={{ fontSize: 10, marginBottom: 2 }}>
                      {k}: {typeof v === 'string' && (v as string).length > 25
                        ? (v as string).substring(0, 25) + '…'
                        : String(v)}
                    </Tag>
                  ))}
                  {entries.length > 3 && (
                    <Tag style={{ fontSize: 10, color: '#888' }}>+{entries.length - 3} 项</Tag>
                  )}
                </Space>
              );
            },
          },
          {
            title: '', key: 'action', width: 50,
            render: (_: any, r: any) => (
              <Button size="small" type="text" icon={<EyeOutlined />}
                onClick={() => openDetail(r)} />
            ),
          },
        ]}
        locale={{ emptyText: '暂无审计记录' }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p) => setPage(p),
        }}
        scroll={{ x: 900, y: 'calc(100vh - 320px)' }}
      />

      {/* Detail Drawer */}
      <Drawer
        title="审计详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={480}
      >
        {detailLog && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="时间">
              {dayjs(detailLog.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="操作">
              <Tag color={actionColor(detailLog.action_label || '')}>{detailLog.action_label}</Tag>
              <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 11 }}>
                ({detailLog.action})
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="资源类型">{detailLog.resource_type}</Descriptions.Item>
            <Descriptions.Item label="资源">
              <Tag>{detailLog.resource_type}</Tag>
              {detailLog.resource_name ? (
                <Typography.Text style={{ marginLeft: 8 }}>{detailLog.resource_name}</Typography.Text>
              ) : (
                <code style={{ marginLeft: 8, fontSize: 11 }}>{detailLog.resource_id}</code>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="操作人">
              {detailLog.user_name || '-'}
              {detailLog.user_phone && <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>{detailLog.user_phone}</span>}
            </Descriptions.Item>
            <Descriptions.Item label="工作区">{detailLog.workspace_name || detailLog.workspace_id}</Descriptions.Item>
            <Descriptions.Item label="IP">{detailLog.ip_address || '-'}</Descriptions.Item>
            <Descriptions.Item label="详情">
              {detailLog.details && Object.keys(detailLog.details).length > 0 ? (
                <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(detailLog.details, null, 2)}
                </pre>
              ) : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
