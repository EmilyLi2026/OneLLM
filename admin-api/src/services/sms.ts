/**
 * Aliyun SMS Service (Dysmsapi)
 *
 * Sends verification codes via Aliyun SMS.
 * Credentials are read from environment variables.
 */

import Dysmsapi20170525, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';

function createClient(): Dysmsapi20170525 {
  const config = new $OpenApi.Config({
    accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || '',
  });
  config.endpoint = process.env.ALIYUN_SMS_ENDPOINT || 'dysmsapi.aliyuncs.com';
  return new Dysmsapi20170525(config);
}

/**
 * Send a verification code via SMS.
 * Returns true if the SMS was accepted by Aliyun.
 */
export async function sendVerificationCode(phone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  // Dev mode: skip SMS, just log to console
  if (process.env.SMS_DEV_MODE === 'true') {
    console.log('');
    console.log('══ DEV MODE ═══════════════════════════════');
    console.log(`  手机号: ${phone}`);
    console.log(`  验证码: ${code}`);
    console.log('═══════════════════════════════════════════');
    console.log('');
    return { ok: true };
  }

  try {
    const client = createClient();
    const request = new SendSmsRequest({
      phoneNumbers: phone,
      signName: process.env.ALIYUN_SMS_SIGN_NAME || '叮咚AI',
      templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || '',
      templateParam: JSON.stringify({ code }),
    });

    const response = await client.sendSms(request);

    if (response.body?.code === 'OK') {
      console.log(`SMS sent to ${phone}, code=${code}, bizId=${response.body.bizId}`);
      return { ok: true };
    }

    console.error(`SMS failed for ${phone}: ${response.body?.code} - ${response.body?.message}`);
    return { ok: false, error: response.body?.message || '短信发送失败' };
  } catch (error: any) {
    console.error('SMS send error:', error.message);
    return { ok: false, error: '短信服务异常，请稍后重试' };
  }
}

/**
 * Generate a random 6-digit verification code
 */
export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
