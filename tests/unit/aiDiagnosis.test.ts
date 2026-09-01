import { describe, it, expect } from '../assert.js';
import { AIDiagnosisService } from '../../src/services/ai/aiDiagnosisService.js';
import { WealthPathService } from '../../src/services/ai/wealthPathService.js';

describe('Financial Diagnosis Engine & 7 Life Stages Classification', () => {
  it('correctly classifies Stage 1 Recovery for negative cash flow', () => {
    const stage = AIDiagnosisService.determineLifeStage(5, -10000, 55, 45);
    expect(stage.stageNumber).toBe(1);
    expect(stage.stageName).toBe('Financial Recovery');
  });

  it('correctly classifies Stage 3 Foundation for 15% savings rate', () => {
    const stage = AIDiagnosisService.determineLifeStage(15, 15000, 25, 72);
    expect(stage.stageNumber).toBe(3);
    expect(stage.stageName).toBe('Financial Foundation');
  });

  it('accurately calculates compounding years and months for ₹1 Crore Wealth Path', () => {
    const result = WealthPathService.calculateWealthPath(500000, 10000000, 25000, 12);
    expect(result.estimatedMonthsToTarget).toBeGreaterThan(0);
    expect(result.formattedTarget).toContain('₹1,00,00,000');
    expect(result.aiPathExplanation).toContain('investing');
  });
});
