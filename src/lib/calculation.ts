import { ProjectData, CostSummary, DailyCostBreakdown, DEFAULT_MEAL_CONFIG, OtherExpenses } from '@/types';

// 计算单餐费用
function calculateMealAmount(
  mealConfig: { clientMealType?: string; tableCount?: number; clientCount?: number; pricePerPerson?: number; staffMealType?: string; amount?: number },
  coreConfig: ProjectData['coreConfig'],
  totalClients: number,
  totalStaff: number
): number {
  // 如果有手动输入的金额，直接使用
  if (mealConfig.amount && mealConfig.amount > 0) {
    return mealConfig.amount;
  }
  
  // 使用单价（优先使用每餐配置的单价，否则使用客户配置的餐标）
  const pricePerPerson = mealConfig.pricePerPerson || coreConfig.mealStandardClient || 0;
  
  // 客户餐费
  const clientMealType = mealConfig.clientMealType || 'individual';
  const clientAmount = clientMealType === 'table'
    ? pricePerPerson * 10 * (mealConfig.tableCount || Math.ceil(totalClients / 10))
    : pricePerPerson * (mealConfig.clientCount || totalClients);
  
  // 工作人员餐费
  const staffAmount = mealConfig.staffMealType === 'independent'
    ? (coreConfig.mealStandardStaff || 0) * totalStaff
    : 0;
  
  return clientAmount + staffAmount;
}

// 计算其他费用总额
function calculateOtherExpenses(otherExpenses: OtherExpenses, totalClients: number, totalStaff: number): number {
  // 保险费
  const insuranceTotal = otherExpenses.insurance.totalAmount || 0;
  
  // 备用金
  const reserveFund = otherExpenses.reserveFund || 0;
  
  // 物料费
  const materialsTotal = otherExpenses.materials.reduce((sum, item) => 
    sum + (item.totalPrice || item.price * item.quantity), 0);
  
  // 其他费用
  const otherTotal = otherExpenses.otherExpenses.reduce((sum, item) => 
    sum + item.amount, 0);
  
  return insuranceTotal + reserveFund + materialsTotal + otherTotal;
}

// 计算服务费（基于总成本）
export function calculateServiceFee(totalCost: number, serviceFeePercent: number): number {
  return totalCost * (serviceFeePercent / 100);
}

// 计算成本汇总
export function calculateCostSummary(data: ProjectData): CostSummary {
  const { coreConfig, dailyExpenses, otherExpenses } = data;
  
  // 计算总人数
  const totalClients = coreConfig.studentCount + coreConfig.parentCount + coreConfig.teacherCount;
  const totalStaff = coreConfig.staffMembers.reduce((sum, member) => sum + member.count, 0);
  
  // 计算住宿费用
  // 客户住宿费用（双床房 + 大床房）
  const clientTwinRoomTotal = (coreConfig.twinRoom?.price || 0) * (coreConfig.twinRoom?.countClient || 0) * coreConfig.accommodationDays;
  const clientKingRoomTotal = (coreConfig.kingRoom?.price || 0) * (coreConfig.kingRoom?.countClient || 0) * coreConfig.accommodationDays;
  
  // 工作人员住宿费用
  const staffAccommodationTotal = coreConfig.staffAccommodation
    ? (coreConfig.staffRoomPrice || 0) * Math.ceil(totalStaff / 2) * (coreConfig.staffAccommodationNights || 0)
    : 0;
  
  const totalAccommodation = clientTwinRoomTotal + clientKingRoomTotal + staffAccommodationTotal;
  
  // 计算用餐费用（中餐 + 晚餐）
  let totalMeal = 0;
  dailyExpenses.forEach(day => {
    const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
    const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
    totalMeal += calculateMealAmount(lunch, coreConfig, totalClients, totalStaff);
    totalMeal += calculateMealAmount(dinner, coreConfig, totalClients, totalStaff);
  });
  
  // 计算交通费用（大巴 + 飞机 + 高铁）
  const totalBus = coreConfig.busFee || 0;
  const totalFlight = (coreConfig.flightEnabled ? (coreConfig.flightPrice || 0) * (coreConfig.flightCount || 0) : 0);
  const totalTrain = (coreConfig.trainEnabled ? (coreConfig.trainPrice || 0) * (coreConfig.trainCount || 0) : 0);
  const totalTransport = totalBus + totalFlight + totalTrain;
  
  // 计算工作人员费用
  let totalStaffFee = 0;
  dailyExpenses.forEach(day => {
    coreConfig.staffMembers.forEach(member => {
      const dailyFee = day.staffFees[member.id] ?? member.dailyFee;
      totalStaffFee += dailyFee * member.count;
    });
  });
  
  // 计算单项费用
  let totalSingleItems = 0;
  dailyExpenses.forEach(day => {
    day.singleItems.forEach(item => {
      totalSingleItems += item.totalPrice || (item.price * item.count);
    });
  });
  
  // 计算其他费用（不含服务费，服务费在报价时计算）
  const totalOtherExpenses = calculateOtherExpenses(otherExpenses, totalClients, totalStaff);
  
  // 计算总成本
  const totalCost = 
    totalAccommodation +
    totalMeal +
    totalTransport +
    totalStaffFee +
    totalSingleItems +
    totalOtherExpenses;
  
  // 计算人均成本（按客户人数）
  const avgCostPerClient = totalClients > 0 ? totalCost / totalClients : 0;
  
  // 计算每日明细
  const dailyBreakdown: DailyCostBreakdown[] = dailyExpenses.map(day => {
    let dayStaffFee = 0;
    coreConfig.staffMembers.forEach(member => {
      const dailyFee = day.staffFees[member.id] ?? member.dailyFee;
      dayStaffFee += dailyFee * member.count;
    });
    
    const daySingleItems = day.singleItems.reduce((sum, item) => 
      sum + (item.totalPrice || item.price * item.count), 0);
    
    const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
    const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
    const lunchAmount = calculateMealAmount(lunch, coreConfig, totalClients, totalStaff);
    const dinnerAmount = calculateMealAmount(dinner, coreConfig, totalClients, totalStaff);
    
    const dailyTotal = 
      day.accommodation + 
      lunchAmount + 
      dinnerAmount + 
      dayStaffFee + 
      daySingleItems;
    
    return {
      day: day.day,
      accommodation: day.accommodation,
      lunch: lunchAmount,
      dinner: dinnerAmount,
      staffFee: dayStaffFee,
      singleItems: daySingleItems,
      dailyTotal,
    };
  });
  
  return {
    totalClients,
    totalStaff,
    totalAccommodation,
    totalMeal,
    totalBus: totalTransport,
    totalStaffFee,
    totalSingleItems,
    totalOtherExpenses,
    totalCost,
    avgCostPerClient,
    dailyBreakdown,
  };
}

// 格式化金额
export function formatMoney(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

// 生成初始每日费用数据
export function generateInitialDailyExpenses(tripDays: number, staffMembers: { id: string; dailyFee: number }[]) {
  const staffFees: Record<string, number> = {};
  staffMembers.forEach(member => {
    staffFees[member.id] = member.dailyFee;
  });
  
  return Array.from({ length: tripDays }, (_, index) => ({
    day: index + 1,
    accommodation: 0,
    lunch: { ...DEFAULT_MEAL_CONFIG, restaurantName: '' },
    dinner: { ...DEFAULT_MEAL_CONFIG, restaurantName: '' },
    staffFees: { ...staffFees },
    singleItems: [],
  }));
}
