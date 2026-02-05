import React, { useEffect, useState } from 'react';
import { VERCEL_PROXY_URL } from '../config/apiKeys.js';

interface UsageData {
  valid: boolean;
  tier: string;
  plan: string;
  billing_cycle: string;
  generations: {
    included: number;
    used: number;
    remaining: number;
    percentage: number;
  };
  overage: {
    enabled: boolean;
    rate: number;
    used: number;
    cost: number;
    required: boolean;
    estimated_cost: number;
  };
  status: 'normal' | 'warning' | 'overage' | 'exceeded';
  warning?: string;
  next_reset?: string;
}

interface PlanPricing {
  name: string;
  monthlyPrice: number;
  generations: number;
}

// Plan pricing for upgrade recommendations
const PLAN_PRICING: PlanPricing[] = [
  { name: 'free', monthlyPrice: 0, generations: 30 },
  { name: 'starter', monthlyPrice: 10, generations: 100 },
  { name: 'pro', monthlyPrice: 29, generations: 500 },
  { name: 'pro_plus', monthlyPrice: 49, generations: 750 },
  { name: 'ultimate', monthlyPrice: 99, generations: 10000 },
];

interface UsageDisplayProps {
  licenseKey: string;
  showUpgradeRecommendation?: boolean;
  compact?: boolean;
}

const UsageDisplay: React.FC<UsageDisplayProps> = ({ 
  licenseKey, 
  showUpgradeRecommendation = true,
  compact = false 
}) => {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!licenseKey || licenseKey.trim().length === 0) {
      setLoading(false);
      return;
    }

    fetchUsage();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, [licenseKey]);

  const fetchUsage = async () => {
    if (!licenseKey || licenseKey.trim().length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${VERCEL_PROXY_URL}/usage-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ licenseKey }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage');
      }

      const data = await response.json();
      setUsageData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching usage:', err);
      setError('Failed to load usage data');
      setUsageData(null);
    } finally {
      setLoading(false);
    }
  };

  const getUpgradeRecommendation = (): { show: boolean; message: string; nextTier: string; nextTierPrice: number } | null => {
    if (!usageData || !showUpgradeRecommendation) return null;

    const { tier, overage } = usageData;
    const currentPlan = PLAN_PRICING.find(p => p.name === tier);
    if (!currentPlan) return null;

    // Find next tier
    const currentIndex = PLAN_PRICING.findIndex(p => p.name === tier);
    if (currentIndex === -1 || currentIndex === PLAN_PRICING.length - 1) return null;

    const nextPlan = PLAN_PRICING[currentIndex + 1];
    const priceDelta = nextPlan.monthlyPrice - currentPlan.monthlyPrice;

    // Calculate projected monthly overage cost
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const daysElapsed = currentDay;
    const projectedOverageCost = overage.cost > 0 && daysElapsed > 0
      ? (overage.cost / daysElapsed) * daysInMonth
      : 0;

    // Show recommendation if overages exceed 50-70% of price delta
    const threshold = priceDelta * 0.6; // 60% threshold
    if (projectedOverageCost >= threshold && overage.cost > 0) {
      const tierDisplayName = nextPlan.name === 'pro_plus' ? 'Pro+' : 
                             nextPlan.name.charAt(0).toUpperCase() + nextPlan.name.slice(1);
      
      return {
        show: true,
        message: `You've accrued ~$${overage.cost.toFixed(2)} in overages so far — at this pace, you'll pay ~$${projectedOverageCost.toFixed(0)}+ this month. ${tierDisplayName} is just $${nextPlan.monthlyPrice} flat + more gens and priority features. Upgrade and save?`,
        nextTier: nextPlan.name,
        nextTierPrice: nextPlan.monthlyPrice,
      };
    }

    return null;
  };

  if (loading) {
    return (
      <div style={{ padding: compact ? '8px' : '16px', textAlign: 'center', color: '#5f6368' }}>
        Loading usage...
      </div>
    );
  }

  if (error || !usageData || !usageData.valid) {
    return null; // Don't show anything if no valid license
  }

  const { generations, overage, status, next_reset } = usageData;
  const upgradeRec = getUpgradeRecommendation();

  // Format next reset date
  const formatNextReset = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case 'warning': return '#f59e0b'; // amber
      case 'overage': return '#ef4444'; // red
      case 'exceeded': return '#dc2626'; // dark red
      default: return '#10b981'; // green
    }
  };

  // Get progress bar color
  const getProgressColor = () => {
    if (generations.percentage >= 100) return '#ef4444';
    if (generations.percentage >= 80) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div style={{
      padding: compact ? '12px' : '16px',
      background: status === 'warning' || status === 'overage' || status === 'exceeded' 
        ? '#fef3c7' 
        : '#f8f9fa',
      borderRadius: '8px',
      border: `1px solid ${status === 'warning' || status === 'overage' || status === 'exceeded' ? '#fbbf24' : '#e5e7eb'}`,
      marginTop: compact ? '8px' : '16px',
      fontSize: compact ? '12px' : '13px',
    }}>
      {/* Usage Progress Bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '6px',
          fontSize: compact ? '11px' : '12px',
        }}>
          <span style={{ fontWeight: '600', color: '#202124' }}>
            Generations: {generations.used.toLocaleString()} / {generations.included === 999999999999 ? 'Unlimited' : generations.included.toLocaleString()}
          </span>
          <span style={{ color: getStatusColor(), fontWeight: '500' }}>
            {generations.percentage}%
          </span>
        </div>
        <div style={{
          width: '100%',
          height: compact ? '6px' : '8px',
          backgroundColor: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(generations.percentage, 100)}%`,
            height: '100%',
            backgroundColor: getProgressColor(),
            transition: 'width 0.3s ease',
          }} />
        </div>
        {generations.remaining >= 0 && generations.included !== 999999999999 && (
          <div style={{ 
            marginTop: '4px', 
            fontSize: compact ? '10px' : '11px', 
            color: '#5f6368' 
          }}>
            {generations.remaining.toLocaleString()} remaining
          </div>
        )}
      </div>

      {/* Overage Info */}
      {overage.enabled && overage.used > 0 && (
        <div style={{ 
          marginTop: '8px', 
          padding: '8px', 
          background: '#fee2e2', 
          borderRadius: '4px',
          fontSize: compact ? '11px' : '12px',
        }}>
          <div style={{ color: '#991b1b', fontWeight: '500' }}>
            Overage: {overage.used.toLocaleString()} generations (${overage.cost.toFixed(2)})
          </div>
        </div>
      )}

      {/* Warning/Alert */}
      {status === 'warning' && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: '#fef3c7',
          borderRadius: '4px',
          fontSize: compact ? '11px' : '12px',
          color: '#92400e',
        }}>
          ⚠️ {generations.percentage}% of quota used. {overage.enabled 
            ? `Overage billing will activate at $${overage.rate}/generation.` 
            : 'Consider upgrading to avoid interruptions.'}
        </div>
      )}

      {status === 'exceeded' && !overage.enabled && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: '#fee2e2',
          borderRadius: '4px',
          fontSize: compact ? '11px' : '12px',
          color: '#991b1b',
        }}>
          ❌ Quota exceeded. Please upgrade your plan or enable overages.
        </div>
      )}

      {/* Upgrade Recommendation */}
      {upgradeRec && upgradeRec.show && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: '#dbeafe',
          borderRadius: '6px',
          border: '1px solid #93c5fd',
          fontSize: compact ? '11px' : '12px',
        }}>
          <div style={{ 
            color: '#1e40af', 
            fontWeight: '600', 
            marginBottom: '6px',
            fontSize: compact ? '11px' : '13px',
          }}>
            💡 Upgrade Recommendation
          </div>
          <div style={{ color: '#1e3a8a', marginBottom: '8px', lineHeight: '1.4' }}>
            {upgradeRec.message}
          </div>
          <button
            type="button"
            onClick={() => window.open(`https://xrepl.ai/pricing?license=${licenseKey}`, '_blank')}
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: '#5567b9',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Upgrade to {upgradeRec.nextTier === 'pro_plus' ? 'Pro+' : upgradeRec.nextTier.charAt(0).toUpperCase() + upgradeRec.nextTier.slice(1)}
          </button>
        </div>
      )}

      {/* Next Reset */}
      {next_reset && (
        <div style={{ 
          marginTop: '8px', 
          fontSize: compact ? '10px' : '11px', 
          color: '#6b7280',
          textAlign: 'right',
        }}>
          Resets {formatNextReset(next_reset)}
        </div>
      )}
    </div>
  );
};

export default UsageDisplay;
