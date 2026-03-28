import { ProjectData, CostSummary, DailyCostBreakdown, DEFAULT_MEAL_CONFIG, OtherExpenses } from '@/types';

// 计算单餐费用
function calculateMealAmount(
  mealConfig: { enabled?: boolean; clientMealType?: string; tableCount?: number; clientCount?: number; pricePerPerson?: number; staffMealType?: string; amount?: number },
  coreConfig: ProjectData['coreConfig'],
  totalClients: number,
  totalStaff: number
): number {
  // 如果未启用，返回0
  if (mealConfig.enabled === false) {
    return 0;
  }
  
  // 如果有手动输入的金额，直接使用
  if (mealConfig.amount && mealConfig.amount > 0) {
    return mealConfig.amount;
  }
  
  // 使用单价（优先使用每餐配置的单价，否则使用客户配置的餐标）
  const pricePerPerson = mealConfig.pricePerPerson || coreConfig.mealStandardClient || 0;
  
  // 客户餐费
  const clientMealType = mealConfig.clientMealType || 'table';
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
    sum + (item.totalPrice || item.price * item.quantity), 0);
  
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
  
  // 计算住宿费用 - 优先使用每日实际设置的金额
  let totalAccommodation = 0;
  dailyExpenses.forEach(day => {
    // 如果每日设置了金额，使用每日金额
    if (day.accommodationAmount && day.accommodationAmount > 0) {
      totalAccommodation += day.accommodationAmount;
    } else {
      // 否则根据每日房型配置或客户配置计算
      const twinCount = day.twinRoomCount ?? coreConfig.twinRoom?.countClient ?? 0;
      const twinPrice = day.twinRoomPrice ?? coreConfig.twinRoom?.price ?? 0;
      const kingCount = day.kingRoomCount ?? coreConfig.kingRoom?.countClient ?? 0;
      const kingPrice = day.kingRoomPrice ?? coreConfig.kingRoom?.price ?? 0;
      const clientAccommodation = twinCount * twinPrice + kingCount * kingPrice;
      
      // 工作人员住宿
      let staffAccommodation = 0;
      if (day.staffAccommodationAmount && day.staffAccommodationAmount > 0) {
        staffAccommodation = day.staffAccommodationAmount;
      } else if (coreConfig.staffAccommodation) {
        const staffRoomCount = day.staffRoomCount ?? Math.ceil(totalStaff / 2);
        const staffRoomPrice = day.staffRoomPrice ?? coreConfig.staffRoomPrice ?? 0;
        staffAccommodation = staffRoomCount * staffRoomPrice;
      }
      
      totalAccommodation += clientAccommodation + staffAccommodation;
    }
  });
  
  // 计算用餐费用（中餐 + 晚餐）
  let totalMeal = 0;
  dailyExpenses.forEach(day => {
    const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
    const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
    totalMeal += calculateMealAmount(lunch, coreConfig, totalClients, totalStaff);
    totalMeal += calculateMealAmount(dinner, coreConfig, totalClients, totalStaff);
  });
  
  // 计算交通费用（大巴 + 其他交通方式）
  const totalBus = coreConfig.busFee || 0;
  const otherTransportsTotal = (coreConfig.otherTransports || []).reduce((sum, t) => sum + t.price * t.count, 0);
  const totalTransport = totalBus + otherTransportsTotal;
  
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
    // 工作人员费用
    let dayStaffFee = 0;
    coreConfig.staffMembers.forEach(member => {
      const dailyFee = day.staffFees[member.id] ?? member.dailyFee;
      dayStaffFee += dailyFee * member.count;
    });
    
    // 单项费用
    const daySingleItems = day.singleItems.reduce((sum, item) => 
      sum + (item.totalPrice || item.price * item.count), 0);
    
    // 用餐费用
    const lunch = day.lunch || DEFAULT_MEAL_CONFIG;
    const dinner = day.dinner || DEFAULT_MEAL_CONFIG;
    const lunchAmount = calculateMealAmount(lunch, coreConfig, totalClients, totalStaff);
    const dinnerAmount = calculateMealAmount(dinner, coreConfig, totalClients, totalStaff);
    
    // 住宿费用 - 优先使用每日实际设置的金额
    let dayAccommodation = 0;
    if (day.accommodationAmount && day.accommodationAmount > 0) {
      dayAccommodation = day.accommodationAmount;
    } else {
      const twinCount = day.twinRoomCount ?? coreConfig.twinRoom?.countClient ?? 0;
      const twinPrice = day.twinRoomPrice ?? coreConfig.twinRoom?.price ?? 0;
      const kingCount = day.kingRoomCount ?? coreConfig.kingRoom?.countClient ?? 0;
      const kingPrice = day.kingRoomPrice ?? coreConfig.kingRoom?.price ?? 0;
      const clientAccommodation = twinCount * twinPrice + kingCount * kingPrice;
      
      let staffAccommodation = 0;
      if (day.staffAccommodationAmount && day.staffAccommodationAmount > 0) {
        staffAccommodation = day.staffAccommodationAmount;
      } else if (coreConfig.staffAccommodation) {
        const staffRoomCount = day.staffRoomCount ?? Math.ceil(totalStaff / 2);
        const staffRoomPrice = day.staffRoomPrice ?? coreConfig.staffRoomPrice ?? 0;
        staffAccommodation = staffRoomCount * staffRoomPrice;
      }
      
      dayAccommodation = clientAccommodation + staffAccommodation;
    }
    
    const dailyTotal = dayAccommodation + lunchAmount + dinnerAmount + dayStaffFee + daySingleItems;
    
    return {
      day: day.day,
      accommodation: dayAccommodation,
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
