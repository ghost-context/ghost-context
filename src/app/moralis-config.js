/**
 * Moralis API Configuration
 * 
 * This config makes it easy to switch between Free and Starter plans.
 * 
 * To upgrade to Starter plan:
 * 1. Add MORALIS_PLAN=starter to your .env.local file
 * 2. Test if page limit increases by checking terminal logs
 * 3. Adjust PAGE_SIZE if needed
 */

const PLAN = process.env.MORALIS_PLAN || 'free'; // 'free' | 'starter'

const PLAN_CONFIGS = {
  free: {
    pageSize: 100,           // Free tier max: 100 items per page
    delayMs: 100,            // 100ms delay to avoid rate limits
    throughput: 25,          // ~25 CU/s estimated
    dailyLimit: 40000,       // 40k CU per day
    description: 'Free tier - slower but reliable'
  },
  starter: {
    pageSize: 500,           // Test this after upgrading! Might still be 100
    delayMs: 20,             // Much shorter delay with higher throughput
    throughput: 1000,        // 1,000 CU/s throughput
    monthlyLimit: 2000000,   // 2M CU per month
    description: 'Starter tier - faster with higher limits'
  }
};

const config = PLAN_CONFIGS[PLAN] || PLAN_CONFIGS.free;

export const MoralisConfig = {
  plan: PLAN,
  pageSize: Math.min(config.pageSize, 100), // Safety cap: never exceed 100 for API compatibility
  delayMs: config.delayMs,
  throughput: config.throughput,
  limit: config.dailyLimit || config.monthlyLimit,
  description: config.description,
  
  // Helper to log current config
  logConfig: () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 Moralis Configuration');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Plan: ${PLAN.toUpperCase()}`);
    console.log(`Page Size: ${config.pageSize} items`);
    console.log(`Delay: ${config.delayMs}ms between pages`);
    console.log(`Throughput: ${config.throughput} CU/s`);
    console.log(`Description: ${config.description}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  },
  
  // Helper to estimate analysis time
  estimateTime: (tokenCount, avgHolders) => {
    const pagesPerToken = Math.ceil(avgHolders / config.pageSize);
    const apiTimePerPage = 0.5; // 500ms average
    const totalPages = tokenCount * pagesPerToken;
    const apiTime = totalPages * apiTimePerPage;
    const delayTime = (totalPages * config.delayMs) / 1000;
    const totalSeconds = Math.ceil(apiTime + delayTime);
    
    return {
      totalPages,
      totalSeconds,
      formatted: totalSeconds > 60 
        ? `~${Math.ceil(totalSeconds / 60)} minutes`
        : `~${totalSeconds} seconds`
    };
  },
  
  // Helper to estimate CU cost
  estimateCost: (tokenCount, avgHolders) => {
    const cuPerPage = 50;
    const pagesPerToken = Math.ceil(avgHolders / config.pageSize);
    const totalPages = tokenCount * pagesPerToken;
    const totalCU = totalPages * cuPerPage;
    
    return {
      totalCU,
      formatted: totalCU.toLocaleString() + ' CU'
    };
  }
};

