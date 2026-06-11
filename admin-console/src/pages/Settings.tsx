import { useEffect, useState } from 'react';
import { Card, Typography, Descriptions, Button, message, List, Tag, Spin, Row, Col, Divider, Space, Popconfirm } from 'antd';
import { UserOutlined, TeamOutlined, LinkOutlined, CopyOutlined, StopOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../utils/auth';
import { workspacesAPI } from '../api/client';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: { label: '拥有者', color: 'gold' },
  admin: { label: '管理员', color: 'blue' },
  member: { label: '成员', color: 'green' },
  viewer: { label: '观察者', color: 'default' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: '有效', color: 'green' },
  accepted: { label: '已使用', color: 'default' },
  revoked: { label: '已撤销', color: 'red' },
  expired: { label: '已过期', color: 'orange' },
};

export function SettingsPage() {
  const { getUser, getWorkspace } = useAuth();
  const user = getUser();
  const workspace = getWorkspace();
  const [loading, setLoading] = useState(true);
  const [wsId, setWsId] = useState(workspace?.id || '');
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [lastCode, setLastCode] = useState('');

  const loadData = async () => {
    try {
      const wsId = workspace?.id;
      if (!wsId) return;
      const [memRes, invRes] = await Promise.all([
        workspacesAPI.getMembers(wsId),
        workspacesAPI.listInvitations(wsId),
      ]);
      setMembers(memRes.data.data);
      setInvitations(invRes.data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    if (!wsId) return;
    setGenerating(true);
    try {
      const { data } = await workspacesAPI.createInvitation(wsId, { role: 'member', expires_in_hours: 72 });
      const code = data.data.code;
      setLastCode(code);
      message.success('邀请链接已生成！');
      await loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '生成失败');
    } finally { setGenerating(false); }
  };

  const handleRevoke = async (invId: string) => {
    if (!wsId) return;
    try {
      await workspacesAPI.revokeInvitation(wsId, invId);
      message.success('已撤销');
      await loadData();
    } catch {
      message.error('撤销失败');
    }
  };

  const handleCopy = (code: string) => {
    const url = `${window.location.origin}/join?code=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      message.success('链接已复制到剪贴板，可分享给同事');
    }).catch(() => {
      message.info(`邀请链接: ${url}`);
    });
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!wsId) return;
    try {
      await workspacesAPI.removeMember(wsId, memberId);
      message.success('已移除');
      await loadData();
    } catch { message.error('移除失败'); }
  };

  const activeInvites = invitations.filter(i => i.status === 'active');

  // Current user's role in this workspace (from JWT/session)
  const currentRole = workspace?.role || 'member';
  const canManage = currentRole === 'owner' || currentRole === 'admin';

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <Typography.Title level={4}>设置</Typography.Title>

      <Row gutter={16}>
        {/* ============ 账户信息 ============ */}
        <Col span={12}>
          <Card title={<><UserOutlined /> 账户信息</>}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="用户 ID">
                <code>{user?.id?.substring(0, 24)}...</code>
              </Descriptions.Item>
              <Descriptions.Item label="手机号">{user?.phone || '未绑定'}</Descriptions.Item>
              <Descriptions.Item label="姓名">{user?.name}</Descriptions.Item>
              <Descriptions.Item label="角色">
                <Tag color={ROLE_LABELS[currentRole]?.color}>{ROLE_LABELS[currentRole]?.label || currentRole}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* ============ 团队成员 + 邀请链接 ============ */}
        <Col span={12}>
          <Card
            title={<><TeamOutlined /> 团队成员 ({members.length})</>}
            extra={canManage ? (
              <Button type="primary" icon={<LinkOutlined />} loading={generating} onClick={handleGenerate}>
                生成邀请链接
              </Button>
            ) : null}
          >
            {/* ── 刚生成的邀请链接提示 ── */}
            {lastCode && (
              <div style={{
                background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8,
                padding: '12px 16px', marginBottom: 12,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#389e0d' }}>
                  邀请链接已生成 ✅
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code style={{
                    flex: 1, background: '#fff', border: '1px solid #d9d9d9',
                    borderRadius: 4, padding: '6px 12px', fontSize: 14,
                  }}>
                    /join?code={lastCode}
                  </code>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(lastCode)}>复制</Button>
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                  链接 72 小时内有效，可分享到微信/钉钉/短信
                </div>
              </div>
            )}

            {/* ── 有效邀请列表 ── */}
            {activeInvites.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  有效邀请 ({activeInvites.length})
                </Typography.Text>
                {activeInvites.map((inv: any) => (
                  <div key={inv.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', background: '#fafafa', borderRadius: 6,
                    marginTop: 4, fontSize: 13,
                  }}>
                    <code style={{ fontSize: 13, fontWeight: 600 }}>{inv.code}</code>
                    <Tag>{ROLE_LABELS[inv.role]?.label || inv.role}</Tag>
                    <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
                    <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                      {new Date(inv.expires_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}过期
                    </span>
                    <Space style={{ marginLeft: 'auto' }}>
                      <Button size="small" type="link" icon={<CopyOutlined />} onClick={() => handleCopy(inv.code)}>
                        复制
                      </Button>
                      {canManage && (
                        <Popconfirm title="确定撤销此邀请？" onConfirm={() => handleRevoke(inv.id)}>
                          <Button size="small" type="link" danger icon={<StopOutlined />}>撤销</Button>
                        </Popconfirm>
                      )}
                    </Space>
                  </div>
                ))}
              </div>
            )}

            <Divider style={{ margin: '8px 0 12px' }} />

            {/* ── 成员列表 ── */}
            <List
              size="small"
              dataSource={members}
              locale={{ emptyText: '暂无成员' }}
              renderItem={(m: any) => (
                <List.Item
                  extra={
                    canManage && m.role !== 'owner' ? (
                      <Popconfirm title="确定移除此成员？" onConfirm={() => handleRemoveMember(m.id)}>
                        <Button size="small" danger>移除</Button>
                      </Popconfirm>
                    ) : (m.role === 'owner' ? <Tag color="gold">Owner</Tag> : null)
                  }
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        {m.name}
                        <Tag color={ROLE_LABELS[m.role]?.color}>{ROLE_LABELS[m.role]?.label || m.role}</Tag>
                      </Space>
                    }
                    description={m.phone ? `📱 ${m.phone}` : (m.email || '')}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
