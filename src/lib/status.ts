export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type DeliveryType = 'pickup' | 'delivery' | 'express'

export const getOrderStatusColor = (status: OrderStatus | string) => {
  switch (status) {
    case 'pending':
      return 'orange'
    case 'confirmed':
      return 'blue'
    case 'processing':
      return 'cyan'
    case 'shipped':
      return 'purple'
    case 'delivered':
      return 'green'
    case 'cancelled':
      return 'red'
    case 'refunded':
      return 'default'
    default:
      return 'default'
  }
}

export const getOrderStatusText = (status: OrderStatus | string) => {
  switch (status) {
    case 'pending':
      return '待确认'
    case 'confirmed':
      return '已确认'
    case 'processing':
      return '处理中'
    case 'shipped':
      return '已发货'
    case 'delivered':
      return '已送达'
    case 'cancelled':
      return '已取消'
    case 'refunded':
      return '已退款'
    default:
      return String(status)
  }
}

export const getPaymentStatusColor = (status: PaymentStatus | string) => {
  switch (status) {
    case 'pending':
      return 'orange'
    case 'paid':
      return 'green'
    case 'failed':
      return 'red'
    case 'refunded':
      return 'default'
    default:
      return 'default'
  }
}

export const getPaymentStatusText = (status: PaymentStatus | string) => {
  switch (status) {
    case 'pending':
      return '待支付'
    case 'paid':
      return '已支付'
    case 'failed':
      return '支付失败'
    case 'refunded':
      return '已退款'
    default:
      return String(status)
  }
}

export const getDeliveryTypeText = (type: DeliveryType | string) => {
  switch (type) {
    case 'pickup':
      return '到店自取'
    case 'delivery':
      return '快递配送'
    case 'express':
      return '加急配送'
    default:
      return String(type)
  }
}

