// SPDX-License-Identifier: Apache-2.0
import { http } from '@kit.NetworkKit';

export interface DemoModelConfig { endpoint: string; model: string; apiKey: string; protocol: string; }
export interface DemoGenerationHooks {
  onAttempt?: () => void;
  onCandidate?: (source: string) => void;
  isCurrent?: () => boolean;
}
interface DemoText { type: string; text?: string; }
interface DemoChoice { message: DemoMessage; finish_reason?: string; }
interface DemoMessage { content: string; }
interface DemoReply { choices?: DemoChoice[]; content?: DemoText[]; stop_reason?: string; }
interface DemoRequestMessage { role: string; content: string; }
interface DemoRequestBody { model: string; max_tokens: number; stream: boolean; system?: string; messages: DemoRequestMessage[]; }

/** Example transport, deliberately outside the SDK. No credential persistence. */
export class DemoModel {
  /** A bounded demo-host repair round. The reusable SDK still has no transport. */
  static async generateValidated(config: DemoModelConfig, system: string, prompt: string,
    validate: (source: string) => void, hooks: DemoGenerationHooks = {}): Promise<string> {
    let requestPrompt = prompt;
    for (let attempt = 0; attempt < 2; ++attempt) {
      if (hooks.isCurrent && !hooks.isCurrent()) { throw new Error('DEMO_MODEL_CANCELLED'); }
      hooks.onAttempt?.();
      // Transport/quota/truncation failures propagate; only invalid UI is repaired.
      const source = await DemoModel.generate(config, system, requestPrompt);
      if (hooks.isCurrent && !hooks.isCurrent()) { throw new Error('DEMO_MODEL_CANCELLED'); }
      hooks.onCandidate?.(source);
      try { validate(source); return source; }
      catch (error) {
        if (attempt === 1) { throw error as Error; }
        requestPrompt = prompt + '\n\n上一份界面未通过组件协议校验，请修复后重新输出完整 OpenUI Lang，保留原任务和数据。' +
          '\n校验错误：' + (error as Error).message.slice(0, 500) +
          '\nCard 的顺序是 Card(children,variant,direction,gap,align,justify,wrap)，最多七个参数；' +
          '默认推荐 Card(children) 或 Card(children,"card","column","s")。Stack 第二参数才是 direction。' +
          '\n上一份源码：\n' + source.slice(0, 16000);
      }
    }
    throw new Error('DEMO_MODEL_UI_INVALID');
  }
  static async generate(config: DemoModelConfig, system: string, prompt: string): Promise<string> {
    if (!config.apiKey || !config.model || !config.endpoint.startsWith('https://')) {
      throw new Error('请配置 HTTPS 模型接口、模型名称和 API Key');
    }
    const request = http.createHttp();
    const anthropic = config.protocol === 'anthropic';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (anthropic) { headers['x-api-key'] = config.apiKey; headers['anthropic-version'] = '2023-06-01'; }
    else { headers['Authorization'] = 'Bearer ' + config.apiKey; }
    const messages: DemoRequestMessage[] = anthropic ? [{ role: 'user', content: prompt }] :
      [{ role: 'system', content: system }, { role: 'user', content: prompt }];
    const requestBody: DemoRequestBody = anthropic ? { model: config.model, max_tokens: 4096, stream: false,
      system, messages } : { model: config.model, max_tokens: 4096, stream: false, messages };
    const body = JSON.stringify(requestBody);
    try {
      const response = await request.request(config.endpoint, { method: http.RequestMethod.POST, header: headers,
        extraData: body, connectTimeout: 30000, readTimeout: 120000, expectDataType: http.HttpDataType.STRING });
      if (response.responseCode !== 200) { throw new Error('模型请求失败（HTTP ' + response.responseCode + '）'); }
      const reply = JSON.parse(response.result as string) as DemoReply;
      if (reply.stop_reason === 'max_tokens' || reply.choices?.[0]?.finish_reason === 'length') {
        throw new Error('模型输出被截断，请缩小界面要求或调整输出预算');
      }
      const text = anthropic ? (reply.content ?? []).filter((part: DemoText): boolean => part.type === 'text')
        .map((part: DemoText): string => part.text ?? '').join('\n') : reply.choices?.[0]?.message.content ?? '';
      if (!text.trim()) { throw new Error('模型没有返回界面内容'); }
      if (text.includes('<think>')) { throw new Error('接口将推理放入正文，请改用分离推理的接口或 Anthropic 协议'); }
      if (text.length > 100000) { throw new Error('模型界面超过示例大小上限'); }
      return text;
    } finally { request.destroy(); }
  }
}
