import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Typography, Modal } from 'antd';
import {
  DashboardOutlined, KeyOutlined, RobotOutlined, DollarOutlined,
  FileTextOutlined, SafetyOutlined, SettingOutlined, ToolOutlined,
  CloudServerOutlined, SendOutlined, AppstoreOutlined, FundOutlined,
  UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ExperimentOutlined,
  VerifiedOutlined,
} from '@ant-design/icons';
import { useAuth } from '../utils/auth';

const { Sider, Content } = Layout;

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, getUser } = useAuth();
  const user = getUser();

  const handleLogout = () => {
    Modal.confirm({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      okText: '退出',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => {
        logout();
        navigate('/login', { replace: true });
      },
    });
  };

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'AI 总览' },
    { key: '/keys', icon: <KeyOutlined />, label: 'API Keys' },
    { key: '/budget', icon: <FundOutlined />, label: '预算控制' },
    { key: '/logs', icon: <FileTextOutlined />, label: '调用分析' },
    { key: '/costs', icon: <DollarOutlined />, label: '成本分析' },
    { key: '/models', icon: <AppstoreOutlined />, label: '模型目录' },
    { key: '/providers', icon: <CloudServerOutlined />, label: 'Provider 凭证' },
    { key: '/audit', icon: <SafetyOutlined />, label: '审计日志' },
    { key: '/compliance', icon: <VerifiedOutlined />, label: '合规中心' },
    { key: '/settings', icon: <SettingOutlined />, label: '基础设置' },
    { type: 'divider' as const },
    {
      type: 'group' as const,
      label: '待开放',
      children: [
        { key: '/agents', icon: <RobotOutlined />, label: 'Agent 管理', disabled: true },
        { key: '/mcp', icon: <ToolOutlined />, label: 'MCP 工具', disabled: true },
        { key: '/skills', icon: <ExperimentOutlined />, label: 'Skill 管理', disabled: true },
      ],
    },
  ];

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider collapsed={collapsed} trigger={null}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          {/* Logo — OneLLM */}
          <div style={{
            height: 48, margin: '16px 16px 12px',
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: collapsed ? 0 : 10,
          }}>
            <img src="/logo.png" alt="OneLLM" style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            }} />
            {!collapsed && (
              <Typography.Text strong style={{ color: '#fff', fontSize: 18, letterSpacing: -0.5 }}>
                OneLLM
              </Typography.Text>
            )}
          </div>

          {/* Menu — fills remaining space */}
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => key && navigate(key)}
            style={{ flex: 1, borderRight: 0, overflow: 'auto' }}
          />

          {/* Bottom bar: user (left) + collapse toggle (right) */}
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: collapsed ? '8px' : '8px 12px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            gap: 8,
          }}>
            {/* User */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', borderRadius: 6, flex: 1, minWidth: 0,
                padding: '4px 6px',
                transition: 'background 0.2s',
              }}
              onClick={handleLogout}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              title="退出登录"
            >
              <Avatar size={28} icon={<UserOutlined />} style={{ flexShrink: 0, background: '#1677ff' }}>
                {user?.name?.[0]}
              </Avatar>
              {!collapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name || '用户'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, lineHeight: '16px' }}>
                    退出登录
                  </div>
                </div>
              )}
            </div>

            {/* Collapse toggle */}
            <div
              style={{
                width: 28, height: 28, borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                color: 'rgba(255,255,255,0.45)', fontSize: 14,
                transition: 'color 0.2s, background 0.2s',
              }}
              onClick={() => setCollapsed(!collapsed)}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
          </div>
        </div>
      </Sider>

      {/* Content */}
      <Content style={{ padding: 24, background: '#f5f5f5', overflow: 'auto', height: '100vh' }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: 24 }}>
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}
