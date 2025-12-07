import React from 'react'

interface State { hasError: boolean, error?: any }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, info: any) {
    console.error('页面发生错误:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>页面发生错误</div>
          <div style={{ color: '#666' }}>请刷新页面或返回上一页。若问题持续，请联系管理员。</div>
        </div>
      )
    }
    return this.props.children
  }
}
