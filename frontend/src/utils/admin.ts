export function roleName(role: string) {
  switch (role) {
    case 'admin':
      return '管理员'
    case 'doctor':
      return '医生'
    case 'patient':
      return '患者'
    case 'pharmacist':
      return '药房工作人员'
    default:
      return role
  }
}

export function statusColor(status: string) {
  switch (status) {
    case 'pending':
      return 'orange'
    case 'approved':
      return 'green'
    case 'rejected':
      return 'red'
    default:
      return 'default'
  }
}

export function statusText(status: string) {
  switch (status) {
    case 'pending':
      return '待审核'
    case 'approved':
      return '已通过'
    case 'rejected':
      return '已拒绝'
    default:
      return status
  }
}
