import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Descriptions, Tag, Typography, Row, Col, Statistic, Empty, List, Space } from 'antd';
import { agentsAPI, logsAPI } from '../api/client';
import { formatCost } from '../utils/format';

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<any>(null);
  const [costData, setCostData] = useState<any>(null);
  const [recentActions, setRecentActions] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    agentsAPI.get(id).then(({ data }) => setAgent(data.data)).catch(() => {});
    agentsAPI.getCost(id).then(({ data }) => setCostData(data.data)).catch(() => {});
    logsAPI.query({ agent_id: id, limit: 10, sort_field: 'created_at', sort_order: 'DESC' })
      .then(({ data }) => setRecentActions(data.data?.logs || []))
      .catch(() => {});
  }, [id]);

  if (!agent) return <Empty description="加载中..." />;

  return (
    <div>
      <Typography.Title level={4}>{agent.name}</Typography.Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="Token 消耗" value={agent.total_tokens} /></Card></Col>
        <Col span={6}><Card><Statistic title="费用" value={formatCost(agent.total_cost_cents)} /></Card></Col>
        <Col span={6}><Card><Statistic title="状态" value={agent.status === 'active' ? '活跃' : agent.status} /></Card></Col>
        <Col span={6}><Card><Statistic title="Tier" value={`T${agent.execution_tier}`} /></Card></Col>
      </Row>
      <Card title="基本信息">
        <Descriptions column={2}>
          <Descriptions.Item label="ID">{agent.id}</Descriptions.Item>
          <Descriptions.Item label="默认模型">{agent.default_model}</Descriptions.Item>
          <Descriptions.Item label="描述">{agent.description || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{new Date(agent.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="成本详情" style={{ marginTop: 16 }}>
        {costData ? (
          <Descriptions column={3}>
            <Descriptions.Item label="总 Token">{costData.summary?.total_tokens || 0}</Descriptions.Item>
            <Descriptions.Item label="总费用">¥{(costData.summary?.total_cost_yuan || 0)}</Descriptions.Item>
            <Descriptions.Item label="统计周期">{costData.period || '全部'}</Descriptions.Item>
          </Descriptions>
        ) : <Typography.Text type="secondary">暂无成本数据，Agent 产生调用后自动更新</Typography.Text>}
      </Card>
      <Card title="最近操作" style={{ marginTop: 16 }}>
        {recentActions.length > 0 ? (
          <List size="small" dataSource={recentActions} renderItem={(r: any) => (
            <List.Item style={{ padding: '4px 0' }}>
              <Space size={8} style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space size={6}>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : ''}
                  </Typography.Text>
                  <Tag style={{ fontSize: 11 }}>{r.model}</Tag>
                  {r.action_label && (
                    <Typography.Text style={{ fontSize: 12 }} ellipsis>
                      {r.action_label.length > 40 ? r.action_label.substring(0, 40) + '…' : r.action_label}
                    </Typography.Text>
                  )}
                </Space>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {formatCost(r.cost_cents || 0, 4)}
                </Typography.Text>
              </Space>
            </List.Item>
          )} />
        ) : (
          <Typography.Text type="secondary">暂无调用记录</Typography.Text>
        )}
      </Card>
      <Card title="工具权限" style={{ marginTop: 16 }}>
        <Tag color="blue">Phase 2 — 即将推出</Tag>
        <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
          MCP 工具权限管理功能将在 Phase 2 上线
        </Typography.Text>
      </Card>
    </div>
  );
}
