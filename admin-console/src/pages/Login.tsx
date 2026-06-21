import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Form, Input, Button, Typography, message, Segmented } from 'antd';
import {
  PhoneOutlined,
  SafetyOutlined,
  LockOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  FundOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { authAPI } from '../api/client';
import { useAuth } from '../utils/auth';

const stats = [
  { icon: <ApiOutlined />, value: '60+', label: '模型接入', sub: '覆盖国内主流厂商' },
  { icon: <ThunderboltOutlined />, value: '< 50ms', label: '路由延迟', sub: '智能故障转移，零中断' },
  { icon: <FundOutlined />, value: '三层', label: '预算管控', sub: '任务·Agent·工作区 逐级熔断' },
  { icon: <DashboardOutlined />, value: '全链路', label: '可观测性', sub: 'Token / 延迟 / 成本实时追踪' },
];

type LoginMode = 'code' | 'password';

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [mode, setMode] = useState<LoginMode>('code');
  const [setPwdStep, setSetPwdStep] = useState(false);
  const [smsToken, setSmsToken] = useState<string | null>(null);
  const [smsUser, setSmsUser] = useState<any>(null);
  const [smsWorkspace, setSmsWorkspace] = useState<any>(null);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const prevPhoneRef = useRef<string>('');

  // Auto-login via URL token (from frontend cross-origin bridge)
  useEffect(() => {
    const token = searchParams.get('token');
    const name = searchParams.get('name');
    const id = searchParams.get('id');
    if (token && name && id && !isAuthenticated) {
      login(token, { id, name });
      message.success('已自动登录，正在跳转...');
      setTimeout(() => navigate('/', { replace: true }), 300);
    }
  }, [searchParams]);

  // Watch phone field changes — reset countdown when user switches number
  const currentPhone = Form.useWatch('phone', form);
  useEffect(() => {
    if (currentPhone && currentPhone !== prevPhoneRef.current) {
      prevPhoneRef.current = currentPhone;
      setCountdown(0);
    }
  }, [currentPhone]);

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

  // Reset form when switching mode (keep phone)
  const handleModeChange = (val: string | number) => {
    const newMode = val as LoginMode;
    const phone = form.getFieldValue('phone');
    form.resetFields();
    if (phone) form.setFieldValue('phone', phone);
    setMode(newMode);
  };

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
        message.error(res.data.message || '发送失败');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || '发送失败');
    } finally { setSending(false); }
  };

  // ── SMS Code Login ──
  const handleCodeSubmit = async (values: { phone: string; code: string }) => {
    setLoading(true);
    try {
      const res = await authAPI.loginWithPhone(values.phone, values.code);
      if (res.data.status !== 'success') {
        message.error(res.data.message || '登录失败');
        return;
      }
      const { token, user, workspace, has_password } = res.data.data;

      if (has_password) {
        // Returning user with password set → go straight in
        login(token, user, workspace);
        message.success('登录成功！正在跳转...');
        setTimeout(() => navigate('/'), 500);
      } else {
        // New user → show set-password step
        // Save token + user/workspace so handleSetPassword can auto-login after
        setSmsToken(token);
        setSmsUser(user);
        setSmsWorkspace(workspace);
        setSetPwdStep(true);
        form.resetFields();
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || '网络连接失败，请确认后端服务已启动');
    } finally { setLoading(false); }
  };

  // ── Password Login ──
  const handlePasswordSubmit = async (values: { phone: string; password: string }) => {
    setLoading(true);
    try {
      const res = await authAPI.loginWithPassword(values.phone, values.password);
      if (res.data.status !== 'success') {
        message.error(res.data.message || '登录失败');
        return;
      }
      const { token, user, workspace } = res.data.data;
      login(token, user, workspace);
      message.success('登录成功！正在跳转...');
      setTimeout(() => navigate('/'), 500);
    } catch (err: any) {
      message.error(err.response?.data?.message || '网络连接失败，请确认后端服务已启动');
    } finally { setLoading(false); }
  };

  // ── Set Password (after SMS login) ──
  const handleSetPassword = async (values: { password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      message.error('两次输入的密码不一致');
      return;
    }
    if (!smsToken) return;
    setLoading(true);
    try {
      await authAPI.setPassword(smsToken, values.password);
      // Auto-login after password is set — store token & user info from SMS login
      login(smsToken, smsUser, smsWorkspace);
      message.success('密码设置成功！正在跳转...');
      setTimeout(() => navigate('/'), 500);
    } catch (err: any) {
      message.error(err.response?.data?.message || '设置密码失败');
    } finally { setLoading(false); }
  };

  const handleSkipPassword = () => {
    // Log the user in with SMS token even if they skip setting a password
    if (smsToken && smsUser) {
      login(smsToken, smsUser, smsWorkspace);
    }
    navigate('/');
  };

  // ═══════════════════════════════════════════
  // RENDER: Set Password Step
  // ═══════════════════════════════════════════
  if (setPwdStep) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* LEFT: Brand Panel (same as login) */}
        <div style={{
          flex: '0 0 48%',
          background: 'linear-gradient(160deg, #030712 0%, #0f1d3a 30%, #102a4c 60%, #0a1628 100%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '72px 64px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(59,130,246,0.08) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(59,130,246,0.35)',
              }}>
                <img src="/logo.png" alt="OneLLM" style={{ width: 30, height: 30 }} />
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1 }}>OneLLM</div>
                <div style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' }}>Enterprise Gateway</div>
              </div>
            </div>
            <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 700, lineHeight: 1.25, margin: 0, letterSpacing: -1 }}>
              设置登录密码
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.7, margin: '16px 0 0', maxWidth: 420 }}>
              为了账号安全，请设置一个密码。<br />之后可以使用手机号 + 密码快速登录。
            </p>
          </div>
          <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', paddingTop: 56 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'rgba(255,255,255,0.18)', fontSize: 12 }}>
              <span>©2026 叮咚数智（天津）科技有限公司</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>v0.1.0</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Set Password Form */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#fafbfc', padding: '48px' }}>
          <div style={{ width: '100%', maxWidth: 400 }}>
            <Typography.Title level={2} style={{ marginBottom: 6, fontWeight: 700, fontSize: 28, letterSpacing: -0.5 }}>
              设置密码
            </Typography.Title>
            <Typography.Text style={{ color: '#64748b', fontSize: 14 }}>
              密码至少 6 位
            </Typography.Text>

            <Form form={form} onFinish={handleSetPassword} size="large" style={{ marginTop: 32 }}>
              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}
                style={{ marginBottom: 20 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="请输入新密码（至少6位）"
                  style={{ borderRadius: 10, height: 50, fontSize: 15, border: '1px solid #e2e8f0' }}
                />
              </Form.Item>

              <Form.Item
                name="confirm"
                rules={[{ required: true, message: '请确认密码' }]}
                style={{ marginBottom: 28 }}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="再次输入密码"
                  style={{ borderRadius: 10, height: 50, fontSize: 15, border: '1px solid #e2e8f0' }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={loading}
                  style={{ height: 50, borderRadius: 10, fontSize: 16, fontWeight: 600, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.3)' }}
                >
                  确认设置
                </Button>
              </Form.Item>

              <Button type="link" block onClick={handleSkipPassword} style={{ color: '#94a3b8', fontSize: 13 }}>
                跳过，以后再说
              </Button>
            </Form>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // RENDER: Login (dual-mode)
  // ═══════════════════════════════════════════
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ======== LEFT: Brand Panel ======== */}
      <div style={{
        flex: '0 0 48%',
        background: 'linear-gradient(160deg, #030712 0%, #0f1d3a 30%, #102a4c 60%, #0a1628 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '72px 64px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(59,130,246,0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
        }} />
        <div style={{
          position: 'absolute', top: '-12%', right: '-8%',
          width: 520, height: 520, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.04) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', left: '-10%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.02) 50%, transparent 70%)',
          filter: 'blur(80px)',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(59,130,246,0.35)',
            }}>
              <img src="/logo.png" alt="OneLLM" style={{ width: 30, height: 30 }} />
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1 }}>OneLLM</div>
              <div style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' }}>Enterprise Gateway</div>
            </div>
          </div>

          <div style={{ marginBottom: 48 }}>
            <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 700, lineHeight: 1.25, margin: 0, letterSpacing: -1 }}>
              企业级 AI 网关
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.7, margin: '16px 0 0', maxWidth: 420 }}>
              一套 API 统一接入 60+ 模型与 12 家国产大厂，<br />
              智能路由、三层预算管控、全链路可观测 ——<br />
              让每一次模型调用都安全、可控、可追溯。
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 460 }}>
            {stats.map((s) => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                padding: '18px 16px',
                backdropFilter: 'blur(12px)',
                transition: 'all 0.3s ease',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'rgba(59,130,246,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, color: '#60a5fa', marginBottom: 10,
                }}>{s.icon}</div>
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 2 }}>{s.value}</div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{s.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 1.5 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', paddingTop: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, color: 'rgba(255,255,255,0.18)', fontSize: 12 }}>
            <span>©2026 叮咚数智（天津）科技有限公司</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>v0.1.0</span>
          </div>
        </div>
      </div>

      {/* ======== RIGHT: Login Form ======== */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#fafbfc',
        padding: '48px',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 32 }}>
            <Typography.Title level={2} style={{ marginBottom: 6, fontWeight: 700, fontSize: 28, letterSpacing: -0.5 }}>
              欢迎回来
            </Typography.Title>
            <Typography.Text style={{ color: '#64748b', fontSize: 14 }}>
              新用户验证手机号后自动注册账号
            </Typography.Text>
          </div>

          {/* ── Mode Tab ── */}
          <Segmented
            block
            value={mode}
            onChange={handleModeChange}
            options={[
              { label: '验证码登录', value: 'code' },
              { label: '密码登录', value: 'password' },
            ]}
            style={{ marginBottom: 28, padding: 3, background: '#f1f5f9', borderRadius: 10 }}
          />

          {/* ── SMS Code Form ── */}
          {mode === 'code' && (
            <Form form={form} onFinish={handleCodeSubmit} size="large">
              <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }]} style={{ marginBottom: 20 }}>
                <Input
                  prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="请输入手机号"
                  style={{ borderRadius: 10, height: 50, fontSize: 15, border: '1px solid #e2e8f0' }}
                />
              </Form.Item>

              <Form.Item name="code" rules={[{ required: true, message: '请输入验证码' }]} style={{ marginBottom: 28 }}>
                <Input
                  prefix={<SafetyOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="6 位验证码"
                  maxLength={6}
                  style={{ borderRadius: 10, height: 50, fontSize: 15, letterSpacing: 3, border: '1px solid #e2e8f0' }}
                  suffix={
                    <Button type="link" size="small" onClick={handleSendCode} loading={sending} disabled={countdown > 0}
                      style={{ color: countdown > 0 ? '#94a3b8' : '#2563eb', fontWeight: 600, fontSize: 13, padding: 0 }}>
                      {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
                    </Button>
                  }
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 20 }}>
                <Button type="primary" htmlType="submit" block loading={loading}
                  style={{ height: 50, borderRadius: 10, fontSize: 16, fontWeight: 600, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.3)' }}>
                  登录 / 注册
                </Button>
              </Form.Item>
            </Form>
          )}

          {/* ── Password Form ── */}
          {mode === 'password' && (
            <Form form={form} onFinish={handlePasswordSubmit} size="large">
              <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }]} style={{ marginBottom: 20 }}>
                <Input
                  prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="请输入手机号"
                  style={{ borderRadius: 10, height: 50, fontSize: 15, border: '1px solid #e2e8f0' }}
                />
              </Form.Item>

              <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]} style={{ marginBottom: 28 }}>
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="请输入密码"
                  style={{ borderRadius: 10, height: 50, fontSize: 15, border: '1px solid #e2e8f0' }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 20 }}>
                <Button type="primary" htmlType="submit" block loading={loading}
                  style={{ height: 50, borderRadius: 10, fontSize: 16, fontWeight: 600, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', border: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.3)' }}>
                  登录
                </Button>
              </Form.Item>
            </Form>
          )}

          <Typography.Text style={{ display: 'block', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
            登录即表示同意 <a href="#" style={{ color: '#2563eb' }}>服务条款</a> 和 <a href="#" style={{ color: '#2563eb' }}>隐私政策</a>
          </Typography.Text>
        </div>
      </div>
    </div>
  );
}
