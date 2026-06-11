import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Form, Input, Button, Typography, message, Result, Spin, Tag } from 'antd';
import { PhoneOutlined, SafetyOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { authAPI } from '../api/client';
import { useAuth } from '../utils/auth';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: { label: '拥有者', color: 'gold' },
  admin: { label: '管理员', color: 'blue' },
  member: { label: '成员', color: 'green' },
  viewer: { label: '观察者', color: 'default' },
};

export function JoinPage() {
  const [searchParams] = useSearchParams();
  const code = (searchParams.get('code') || '').trim().toUpperCase();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [invInfo, setInvInfo] = useState<any>(null);
  const [invError, setInvError] = useState('');
  const [checkingCode, setCheckingCode] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const prevPhoneRef = useRef<string>('');

  // Reset countdown when user switches phone number
  const currentPhone = Form.useWatch('phone', form);
  useEffect(() => {
    if (currentPhone && currentPhone !== prevPhoneRef.current) {
      prevPhoneRef.current = currentPhone;
      setCountdown(0);
    }
  }, [currentPhone]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timerRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    }
    return () => { clearInterval(timerRef.current); };
  }, [countdown]);

  // Validate invitation code on mount
  useEffect(() => {
    if (!code) {
      setInvError('缺少邀请码参数');
      setCheckingCode(false);
      return;
    }
    authAPI.checkInvitation(code)
      .then(res => {
        if (res.data.status === 'success') {
          setInvInfo(res.data.data);
        } else {
          setInvError(res.data.message || '邀请链接无效');
        }
      })
      .catch(err => {
        setInvError(err.response?.data?.message || '无法验证邀请链接');
      })
      .finally(() => setCheckingCode(false));
  }, [code]);

  const handleSendCode = async () => {
    try { await form.validateFields(['phone']); } catch { return; }
    const phone = form.getFieldValue('phone');
    setSending(true);
    try {
      const res = await authAPI.sendCode(phone);
      if (res.data.status === 'success') {
        setCountdown(60);
        if (res.data.data.dev_code) {
          form.setFieldsValue({ code: res.data.data.dev_code });
          message.success(`验证码: ${res.data.data.dev_code}（已自动填入）`);
        } else {
          message.success('验证码已发送');
        }
      } else {
        message.error(res.data.message);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || '发送失败');
    } finally { setSending(false); }
  };

  const handleSubmit = async (values: { phone: string; code: string }) => {
    setLoading(true);
    try {
      const res = await authAPI.acceptInvitation(code, values.phone, values.code);
      if (res.data.status !== 'success') {
        message.error(res.data.message || '加入失败');
        return;
      }
      const { token, user, workspace } = res.data.data;
      login(token, user, workspace);
      message.success(`已加入「${workspace.name}」！`);
      setTimeout(() => navigate('/', { replace: true }), 500);
    } catch (err: any) {
      message.error(err.response?.data?.message || '加入失败，请稍后重试');
    } finally { setLoading(false); }
  };

  // Invalid code screen
  if (checkingCode) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <Spin size="large" tip="验证邀请链接..." />
      </div>
    );
  }

  if (invError || !invInfo) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <Result
          status="error"
          title="邀请链接无效"
          subTitle={invError || '该邀请链接已过期或已被使用'}
          extra={<Button type="primary" onClick={() => navigate('/login')}>去登录</Button>}
        />
      </div>
    );
  }

  // Valid invitation — show join form
  const roleInfo = ROLE_LABELS[invInfo.role] || ROLE_LABELS.member;
  const expiresText = new Date(invInfo.expires_at).toLocaleDateString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{
        width: 420,
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        padding: '40px 36px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/logo.png" alt="AI Hub" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 16 }} />
          <Typography.Title level={3} style={{ marginBottom: 8 }}>加入工作区</Typography.Title>
        </div>

        {/* Workspace info card */}
        <div style={{
          background: '#f0f5ff', borderRadius: 12, padding: '16px 20px',
          marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TeamOutlined style={{ color: '#1a56db', fontSize: 18 }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>{invInfo.workspace_name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
            <UserOutlined />
            <span>由 <b>{invInfo.creator_name}</b> 邀请你加入</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tag color={roleInfo.color}>{roleInfo.label}</Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              有效期至 {expiresText}
            </Typography.Text>
          </div>
        </div>

        {/* Phone + SMS form */}
        <Form form={form} onFinish={handleSubmit} size="large">
          <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input
              prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
              placeholder="手机号"
              style={{ borderRadius: 12, height: 48 }}
            />
          </Form.Item>

          <Form.Item name="code" rules={[{ required: true, message: '请输入验证码' }]}>
            <Input
              prefix={<SafetyOutlined style={{ color: '#94a3b8' }} />}
              placeholder="6位验证码"
              maxLength={6}
              style={{ borderRadius: 12, height: 48 }}
              suffix={
                <Button
                  type="link"
                  size="small"
                  onClick={handleSendCode}
                  loading={sending}
                  disabled={countdown > 0}
                  style={{ color: countdown > 0 ? '#94a3b8' : '#1a56db', fontWeight: 500 }}
                >
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </Button>
              }
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{
                height: 48, borderRadius: 12, fontSize: 15, fontWeight: 600,
                background: 'linear-gradient(135deg, #1a56db, #7c3aed)',
                border: 'none',
              }}
            >
              加入工作区
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Typography.Link onClick={() => navigate('/login')} style={{ fontSize: 13 }}>
              已有账号？去登录
            </Typography.Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
