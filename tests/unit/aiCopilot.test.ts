import { describe, it, expect } from '../assert.js';
import { AICopilotService } from '../../src/services/aiCopilotService.js';

describe('AI Copilot Context & Response Calculations', () => {
  it('generates a structured action plan with priority and step numbers', async () => {
    const plan = await AICopilotService.generateActionPlan('user_test_copilot');
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].stepNumber).toBe(1);
    expect(plan[0].priority).toBe('P0');
  });
});
