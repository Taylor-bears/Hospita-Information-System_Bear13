import React, { useState, useRef, useEffect } from 'react'
import ErrorBoundary from '../../components/ErrorBoundary'
import { Card, Input, Button, Space, message, Avatar, Tag, Spin, Empty, Modal, Form, Select } from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, MedicineBoxOutlined, ClearOutlined, HistoryOutlined } from '@ant-design/icons'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import ReactMarkdown from 'react-markdown'
import moment from 'moment'

const { TextArea } = Input
const { Option } = Select

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  symptoms?: string[]
  recommendations?: string[]
}

interface ConsultationHistory {
  id: string
  title: string
  created_at: string
  message_count: number
  status: 'active' | 'completed'
}

export default function AIConsult() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [consultationHistory, setConsultationHistory] = useState<ConsultationHistory[]>([])
  const [historyModalVisible, setHistoryModalVisible] = useState(false)
  const [symptomModalVisible, setSymptomModalVisible] = useState(false)
  const [currentConsultationId, setCurrentConsultationId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useAuthStore()
  const [symptomForm] = Form.useForm()

  const commonSymptoms = [
    '发热', '咳嗽', '头痛', '胸痛', '腹痛', '恶心', '呕吐', '腹泻',
    '便秘', '乏力', '失眠', '食欲不振', '关节疼痛', '肌肉酸痛', '头晕',
    '心悸', '呼吸困难', '皮肤瘙痒', '皮疹', '鼻塞', '流涕', '咽痛'
  ]

  const bodyParts = [
    '头部', '颈部', '胸部', '腹部', '背部', '腰部', '上肢', '下肢',
    '皮肤', '全身', '眼部', '耳部', '鼻部', '口腔', '咽喉'
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (user?.id) {
      loadConsultationHistory()
      startNewConsultation()
    }
  }, [user])

  const loadConsultationHistory = async () => {
    try {
      const raw = localStorage.getItem('ai_consult_history')
      const list: ConsultationHistory[] = raw ? JSON.parse(raw) : []
      setConsultationHistory(list.slice(0, 10))
    } catch (error) {
      console.error('获取咨询历史失败:', error)
    }
  }

  const startNewConsultation = async () => {
    try {
      const consultationId = `consult_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setCurrentConsultationId(consultationId)
      
      const welcomeMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `您好！我是您的AI医疗助手。我可以帮助您：

🏥 **症状分析**：描述您的症状，我会提供初步分析
💊 **用药建议**：根据症状推荐合适的非处方药
⚠️ **风险提示**：判断是否需要及时就医
📋 **健康建议**：提供日常保健和预防措施

请详细描述您的症状，包括：
- 症状开始的时间和持续时间
- 症状的具体表现和严重程度
- 是否有相关的病史或过敏史
- 目前正在服用的药物

*请注意：我的建议仅供参考，不能替代专业医生的诊断。*`,
        timestamp: new Date().toISOString()
      }

      setMessages([welcomeMessage])
    } catch (error) {
      console.error('开始新咨询失败:', error)
    }
  }

  const saveMessageToLocal = (message: Message, consultationId: string) => {
    try {
      const raw = localStorage.getItem(`ai_messages_${consultationId}`)
      const list: Message[] = raw ? JSON.parse(raw) : []
      localStorage.setItem(`ai_messages_${consultationId}`, JSON.stringify([...list, message]))
    } catch (error) {
      console.error('保存消息失败:', error)
    }
  }

  const saveConsultationToLocal = (title: string) => {
    try {
      const raw = localStorage.getItem('ai_consult_history')
      const list: ConsultationHistory[] = raw ? JSON.parse(raw) : []
      const next: ConsultationHistory = {
        id: currentConsultationId,
        title,
        created_at: new Date().toISOString(),
        message_count: messages.length,
        status: 'active'
      }
      localStorage.setItem('ai_consult_history', JSON.stringify([next, ...list]))
    } catch (error) {
      console.error('保存咨询记录失败:', error)
    }
  }

  const analyzeSymptoms = async (userInput: string) => {
    // 模拟AI症状分析（实际项目中应该调用真实的AI API）
    const symptoms = extractSymptoms(userInput)
    const analysis = generateAnalysis(symptoms, userInput)
    
    return {
      analysis,
      symptoms,
      recommendations: generateRecommendations(symptoms),
      riskLevel: assessRiskLevel(symptoms, userInput)
    }
  }

  const extractSymptoms = (text: string): string[] => {
    const foundSymptoms: string[] = []
    commonSymptoms.forEach(symptom => {
      if (text.includes(symptom)) {
        foundSymptoms.push(symptom)
      }
    })
    return foundSymptoms
  }

  const generateAnalysis = (symptoms: string[], userInput: string): string => {
    if (symptoms.length === 0) {
      return `根据您的描述，我没有识别出具体的症状。请您更详细地描述一下您的身体状况，包括：
- 具体的不适感觉
- 症状出现的时间和持续情况
- 是否有诱发或缓解因素`
    }

    let analysis = `## 症状分析

根据您提到的症状：**${symptoms.join('、')}**

`

    // 根据症状组合生成分析
    if (symptoms.includes('发热') && symptoms.includes('咳嗽')) {
      analysis += `**可能原因**：上呼吸道感染、流感、支气管炎等
**建议**：
- 测量体温，观察发热程度
- 注意休息，多饮水
- 可考虑使用退热药物
`
    } else if (symptoms.includes('腹痛') && symptoms.includes('腹泻')) {
      analysis += `**可能原因**：急性胃肠炎、食物中毒、肠道感染等
**建议**：
- 暂时禁食，让肠胃休息
- 补充电解质和水分
- 避免油腻和刺激性食物
`
    } else if (symptoms.includes('头痛') && symptoms.includes('头晕')) {
      analysis += `**可能原因**：偏头痛、紧张性头痛、血压异常等
**建议**：
- 保持充足睡眠，避免熬夜
- 减少咖啡因摄入
- 适当进行头部按摩
`
    } else {
      analysis += `**观察要点**：
- 症状的持续时间和变化趋势
- 是否与特定活动或时间相关
- 有无伴随其他不适
`
    }

    return analysis
  }

  const generateRecommendations = (symptoms: string[]): string[] => {
    const recommendations: string[] = []
    
    if (symptoms.includes('发热')) {
      recommendations.push('测量体温，记录发热规律')
      recommendations.push('多饮水，保持充足休息')
      recommendations.push('可考虑物理降温或使用退热贴')
    }
    
    if (symptoms.includes('咳嗽')) {
      recommendations.push('保持室内空气湿润')
      recommendations.push('避免吸烟和二手烟')
      recommendations.push('可适量饮用温热的蜂蜜水')
    }
    
    if (symptoms.includes('腹痛')) {
      recommendations.push('热敷腹部，缓解疼痛')
      recommendations.push('避免剧烈运动')
      recommendations.push('记录疼痛的具体位置和性质')
    }
    
    if (symptoms.includes('头痛')) {
      recommendations.push('保持安静的环境，避免强光刺激')
      recommendations.push('适当按摩太阳穴和颈部')
      recommendations.push('保持规律的作息时间')
    }

    if (recommendations.length === 0) {
      recommendations.push('详细记录症状变化')
      recommendations.push('保持良好的生活作息')
      recommendations.push('避免过度劳累和压力')
      recommendations.push('如症状持续或加重请及时就医')
    }

    return recommendations
  }

  const assessRiskLevel = (symptoms: string[], userInput: string): 'low' | 'medium' | 'high' => {
    const highRiskSymptoms = ['胸痛', '呼吸困难', '意识模糊', '剧烈腹痛', '高热不退']
    const mediumRiskSymptoms = ['持续发热', '反复呕吐', '严重腹泻', '持续头痛']
    
    const hasHighRisk = highRiskSymptoms.some(symptom => symptoms.includes(symptom) || userInput.includes(symptom))
    const hasMediumRisk = mediumRiskSymptoms.some(symptom => symptoms.includes(symptom) || userInput.includes(symptom))
    
    if (hasHighRisk) return 'high'
    if (hasMediumRisk) return 'medium'
    return 'low'
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    try {
      // 保存用户消息到数据库
      saveMessageToLocal(userMessage, currentConsultationId)

      // 后端 AI 咨询
      let assistantContent = ''
      try {
        const res = await api.post('/api/ai-consultation', {
          question: inputValue,
          user_id: user?.id
        })
        assistantContent = String(res.data?.answer || '')
      } catch (e) {
        const analysis = await analyzeSymptoms(inputValue)
        assistantContent = analysis.analysis + '\n\n'
        if (analysis.recommendations.length > 0) {
          assistantContent += '## 建议措施\n'
          analysis.recommendations.forEach((rec, index) => {
            assistantContent += `${index + 1}. ${rec}\n`
          })
          assistantContent += '\n'
        }
        if (analysis.riskLevel === 'high') {
          assistantContent += '⚠️ **重要提醒**：您的症状可能需要及时就医，建议尽快到医院就诊。\n\n'
        } else if (analysis.riskLevel === 'medium') {
          assistantContent += '⚠️ **注意事项**：建议您密切观察症状变化，如持续不缓解请及时就医。\n\n'
        }
        assistantContent += '*以上建议仅供参考，具体诊断请以医生意见为准。*'
      }
      
      let assistantContent = analysis.analysis + '\n\n'
      
      if (analysis.recommendations.length > 0) {
        assistantContent += '## 建议措施\n'
        analysis.recommendations.forEach((rec, index) => {
          assistantContent += `${index + 1}. ${rec}\n`
        })
        assistantContent += '\n'
      }
      
      // 根据风险等级添加警告
      if (analysis.riskLevel === 'high') {
        assistantContent += '⚠️ **重要提醒**：您的症状可能需要及时就医，建议尽快到医院就诊。\n\n'
      } else if (analysis.riskLevel === 'medium') {
        assistantContent += '⚠️ **注意事项**：建议您密切观察症状变化，如持续不缓解请及时就医。\n\n'
      }
      
      assistantContent += '*以上建议仅供参考，具体诊断请以医生意见为准。*'

      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        symptoms: analysis.symptoms,
        recommendations: analysis.recommendations
      }

      setMessages(prev => [...prev, assistantMessage])
      saveMessageToLocal(assistantMessage, currentConsultationId)

      // 如果是第一条消息，保存咨询记录
      if (messages.length === 1) {
        const title = inputValue.length > 20 ? inputValue.substring(0, 20) + '...' : inputValue
        saveConsultationToLocal(title)
      }

    } catch (error) {
      console.error('发送消息失败:', error)
      message.error('发送消息失败，请重试')
      
      const errorMessage: Message = {
        id: `msg_${Date.now() + 2}`,
        role: 'assistant',
        content: '抱歉，我遇到了技术问题，暂时无法为您提供分析。请稍后再试，或者联系客服寻求帮助。',
        timestamp: new Date().toISOString()
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleSymptomSubmit = async (values: any) => {
    const symptomText = `我有以下症状：${values.symptoms.join('、')}，主要不适部位是${values.body_part}，症状持续时间为${values.duration}，${values.description}`
    setInputValue(symptomText)
    setSymptomModalVisible(false)
    symptomForm.resetFields()
  }

  const loadHistoryConsultation = async (consultationId: string) => {
    try {
      const raw = localStorage.getItem(`ai_messages_${consultationId}`)
      const historyMessages: Message[] = raw ? JSON.parse(raw) : []
      setMessages(historyMessages)
      setCurrentConsultationId(consultationId)
      setHistoryModalVisible(false)
    } catch (error) {
      message.error('加载历史记录失败')
    }
  }

  const clearChat = () => {
    Modal.confirm({
      title: '清空对话',
      content: '确定要清空当前对话吗？此操作不可恢复。',
      onOk: () => {
        startNewConsultation()
      }
    })
  }

  const getRiskColor = (content: string) => {
    if (content.includes('high') || content.includes('重要提醒')) {
      return 'error'
    } else if (content.includes('medium') || content.includes('注意')) {
      return 'warning'
    }
    return 'processing'
  }

  return (
    <ErrorBoundary>
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">AI智能问诊</h1>
        <p className="text-gray-600">24小时智能医疗助手，为您提供症状分析和健康建议</p>
      </div>

      <Row gutter={24}>
        <Col span={18}>
          <Card 
            className="h-[600px] flex flex-col"
            title={
              <Space>
                <RobotOutlined className="text-blue-500" />
                <span>AI医疗助手</span>
                <Tag color="blue">24小时在线</Tag>
              </Space>
            }
            extra={
              <Space>
                <Button 
                  icon={<HistoryOutlined />}
                  onClick={() => setHistoryModalVisible(true)}
                >
                  历史记录
                </Button>
                <Button 
                  icon={<ClearOutlined />}
                  onClick={clearChat}
                >
                  清空对话
                </Button>
              </Space>
            }
          >
            {/* 消息显示区域 */}
            <div className="flex-1 overflow-y-auto mb-4 p-4 bg-gray-50 rounded-lg">
              {messages.length === 0 ? (
                <Empty description="开始您的健康咨询" />
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                        <div className="flex items-center mb-2">
                          {message.role === 'assistant' && (
                            <Avatar icon={<RobotOutlined />} className="mr-2 bg-blue-500" />
                          )}
                          <span className="text-xs text-gray-500">
                            {moment(message.timestamp).format('HH:mm')}
                          </span>
                          {message.role === 'user' && (
                            <Avatar icon={<UserOutlined />} className="ml-2 bg-green-500" />
                          )}
                        </div>
                        <div className={`p-3 rounded-lg ${
                          message.role === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-white border border-gray-200'
                        }`}>
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                          {message.symptoms && message.symptoms.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="text-xs text-gray-500 mb-1">识别到的症状：</div>
                              <div className="flex flex-wrap gap-1">
                                {message.symptoms.map((symptom, index) => (
                                  <Tag key={index} size="small" color="blue">{symptom}</Tag>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[70%]">
                    <div className="flex items-center mb-2">
                      <Avatar icon={<RobotOutlined />} className="mr-2 bg-blue-500" />
                      <span className="text-xs text-gray-500">分析中...</span>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-gray-200">
                      <Spin />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 输入区域 */}
            <div className="border-t pt-4">
              <Space.Compact style={{ width: '100%' }}>
                <TextArea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="描述您的症状或健康问题..."
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
                <Button 
                  type="primary" 
                  icon={<SendOutlined />}
                  onClick={handleSendMessage}
                  loading={loading}
                  disabled={!inputValue.trim()}
                  style={{ height: 'auto' }}
                >
                  发送
                </Button>
              </Space.Compact>
              <div className="mt-2 flex justify-between items-center">
                <Button 
                  size="small" 
                  icon={<MedicineBoxOutlined />}
                  onClick={() => setSymptomModalVisible(true)}
                >
                  症状选择器
                </Button>
                <span className="text-xs text-gray-400">Shift+Enter 换行</span>
              </div>
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card title="使用提示" className="mb-4">
            <div className="space-y-2 text-sm text-gray-600">
              <div>• 详细描述症状和持续时间</div>
              <div>• 提供相关的病史信息</div>
              <div>• 说明正在服用的药物</div>
              <div>• 描述症状的诱发因素</div>
            </div>
          </Card>

          <Card title="免责声明">
            <div className="text-xs text-gray-500 leading-relaxed">
              AI助手的建议仅供参考，不能替代专业医生的诊断和治疗建议。如症状严重或持续不缓解，请及时就医。
            </div>
          </Card>
        </Col>
      </Row>

      {/* 症状选择器模态框 */}
      <Modal
        title="症状选择器"
        visible={symptomModalVisible}
        onCancel={() => {
          setSymptomModalVisible(false)
          symptomForm.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={symptomForm}
          layout="vertical"
          onFinish={handleSymptomSubmit}
        >
          <Form.Item
            name="symptoms"
            label="主要症状"
            rules={[{ required: true, message: '请至少选择一个症状' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择您的症状"
              style={{ width: '100%' }}
            >
              {commonSymptoms.map(symptom => (
                <Option key={symptom} value={symptom}>{symptom}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="body_part"
            label="主要不适部位"
            rules={[{ required: true, message: '请选择不适部位' }]}
          >
            <Select placeholder="选择不适部位">
              {bodyParts.map(part => (
                <Option key={part} value={part}>{part}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="duration"
            label="持续时间"
            rules={[{ required: true, message: '请选择持续时间' }]}
          >
            <Select placeholder="选择持续时间">
              <Option value="几小时">几小时</Option>
              <Option value="1-2天">1-2天</Option>
              <Option value="3-7天">3-7天</Option>
              <Option value="1-2周">1-2周</Option>
              <Option value="2周以上">2周以上</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="详细描述"
            rules={[{ required: true, message: '请详细描述您的症状' }]}
          >
            <TextArea
              rows={4}
              placeholder="请详细描述您的症状，包括严重程度、诱发因素、缓解因素等"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交症状
              </Button>
              <Button onClick={() => {
                setSymptomModalVisible(false)
                symptomForm.resetFields()
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 历史记录模态框 */}
      <Modal
        title="咨询历史"
        visible={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={800}
      >
        {consultationHistory.length === 0 ? (
          <Empty description="暂无咨询历史" />
        ) : (
          <div className="space-y-4">
            {consultationHistory.map(history => (
              <Card 
                key={history.id} 
                size="small"
                actions={[
                  <Button 
                    type="link" 
                    size="small"
                    onClick={() => loadHistoryConsultation(history.id)}
                  >
                    查看详情
                  </Button>
                ]}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{history.title}</div>
                    <div className="text-sm text-gray-500">
                      {moment(history.created_at).format('YYYY-MM-DD HH:mm')}
                    </div>
                    <div className="text-sm text-gray-600">
                      共 {history.message_count} 条消息
                    </div>
                  </div>
                  <Tag color={history.status === 'active' ? 'blue' : 'green'}>
                    {history.status === 'active' ? '进行中' : '已完成'}
                  </Tag>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </div>
    </ErrorBoundary>
  )
}
