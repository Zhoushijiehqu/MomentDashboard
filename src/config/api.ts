/* API 默认配置 —— 开源版本不内置任何密钥。
 * 首次使用：打开应用 → 设置与备份 → 填入你自己的小米 MiMo API Key
 * （申请地址：https://platform.xiaomimimo.com ，OpenAI 兼容接口）。 */

export const DEFAULT_API = {
  baseUrl: 'https://api.xiaomimimo.com/v1',
  model: 'mimo-v2.5',
  apiKey: '',
};

export const MODEL_OPTIONS = ['mimo-v2.5', 'mimo-v2.5-pro', 'mimo-v2-pro', 'mimo-v2-omni'];
