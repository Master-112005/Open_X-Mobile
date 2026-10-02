import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { initLlama } from 'llama.rn';

import { buildMobileSchedulePrompt, validateMobileScheduleReply } from './mobileAssistantPlanner';

const MODEL_PATH_KEY = '@openx/mobile-llm-model-v1';

class MobileLlmManager {
  context = null;
  loading = null;

  async getModelPath() {
    const path = await AsyncStorage.getItem(MODEL_PATH_KEY);
    return path && new File(path).exists ? path : '';
  }

  async selectModel() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled) return false;
    const model = result.assets?.[0];
    if (!model?.uri || !/\.gguf$/i.test(model.name || model.uri)) {
      throw new Error('Choose a GGUF language model file.');
    }
    const source = new File(model.uri);
    const destination = new File(Paths.document, 'openx-mobile-model.gguf');
    const staged = new File(Paths.document, 'openx-mobile-model.pending.gguf');
    if (staged.exists) staged.delete();
    await source.copy(staged);
    if (destination.exists) destination.delete();
    await staged.move(destination);
    await this.context?.release?.();
    this.context = null;
    await AsyncStorage.setItem(MODEL_PATH_KEY, destination.uri);
    return true;
  }

  async getContext() {
    if (this.context) return this.context;
    if (!this.loading) {
      this.loading = (async () => {
        const modelPath = await this.getModelPath();
        if (!modelPath) throw new Error('Select a GGUF language model in Settings first.');
        this.context = await initLlama({ model: modelPath, n_ctx: 2048, n_threads: 4, n_gpu_layers: 0 });
        return this.context;
      })().finally(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  async interpretSchedule(command, expected) {
    if (!(await this.getModelPath())) return null;
    const context = await this.getContext();
    const result = await context.completion({
      messages: [
        { role: 'system', content: 'You interpret mobile alarms, reminders, and timers. Output only the requested JSON and preserve all trusted schedule values exactly.' },
        { role: 'user', content: buildMobileSchedulePrompt(command, expected) },
      ],
      n_predict: 128,
      temperature: 0,
    });
    return validateMobileScheduleReply(result?.text, expected) ? expected : false;
  }
}

export const mobileLlmManager = new MobileLlmManager();
export default mobileLlmManager;
