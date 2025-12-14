import React, { useState, useRef, useEffect } from 'react'
import ErrorBoundary from '../../components/ErrorBoundary'
import { Card, Input, Button, Space, message, Avatar, Tag, Spin, Empty, Modal, Form, Select, Row, Col, Tooltip, List } from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, MedicineBoxOutlined, ClearOutlined, HistoryOutlined, BulbOutlined } from '@ant-design/icons'
import api from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import ReactMarkdown from 'react-markdown'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()
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

  const quickQuestions = [
    "我最近总是头痛，可能是什么原因？",
    "感冒了吃什么药比较好？",
    "高血压患者饮食需要注意什么？",
    "我想挂号，应该挂哪个科室？"
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
      // Check if there is an active consultation in local storage
      const lastConsultId = localStorage.getItem('last_active_consultation')
      if (lastConsultId) {
        loadHistoryConsultation(lastConsultId)
      } else {
        startNewConsultation()
      }
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
📅 **挂号指引**：根据病情推荐合适的科室

请告诉我您哪里不舒服？`,
        timestamp: new Date().toISOString()
      }

      setMessages([welcomeMessage])
      localStorage.setItem('last_active_consultation', consultationId)
    } catch (error) {
      console.error('Start consultation error:', error)
    }
  }

  const loadHistoryConsultation = (id: string) => {
    try {
      const raw = localStorage.getItem(`consult_${id}`)
      if (raw) {
        setMessages(JSON.parse(raw))
        setCurrentConsultationId(id)
      } else {
        startNewConsultation()
      }
    } catch (error) {
      startNewConsultation()
    }
  }

  const saveCurrentConsultation = (msgs: Message[]) => {
    if (!currentConsultationId) return
    localStorage.setItem(`consult_${currentConsultationId}`, JSON.stringify(msgs))

    // Update history list
    const historyItem: ConsultationHistory = {
      id: currentConsultationId,
      title: msgs.find(m => m.role === 'user')?.content.substring(0, 20) || '新咨询',
      created_at: new Date().toISOString(),
      message_count: msgs.length,
      status: 'active'
    }

    const raw = localStorage.getItem('ai_consult_history')
    let list: ConsultationHistory[] = raw ? JSON.parse(raw) : []
    list = list.filter(i => i.id !== currentConsultationId)
    list.unshift(historyItem)
    localStorage.setItem('ai_consult_history', JSON.stringify(list))
    setConsultationHistory(list.slice(0, 10))
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString()
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInputValue('')
    setLoading(true)
    saveCurrentConsultation(newMessages)

    try {
      const response = await api.post('/api/ai-consultation', {
        question: userMsg.content,
        user_id: user?.id
      }, {
        timeout: 90000 // 增加超时时间到 90 秒
      })

      const aiMsg: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: response.data.answer,
        timestamp: new Date().toISOString(),
        recommendations: response.data.suggestions
      }

      const updatedMessages = [...newMessages, aiMsg]
      setMessages(updatedMessages)
      saveCurrentConsultation(updatedMessages)
    } catch (error: any) {
      console.error('AI consultation failed:', error)
      if (error.code === 'ECONNABORTED') {
        message.error('AI响应超时，请稍后再试')
      } else if (error.response) {
        message.error(`AI服务错误: ${error.response.status}`)
      } else {
        message.error('AI服务暂时不可用，请检查网络连接')
      }

      // Remove the user message if failed? Or keep it and show error?
      // For now, we keep it but maybe add a system message indicating failure
      const errorMsg: Message = {
        id: `msg_err_${Date.now()}`,
        role: 'assistant',
        content: '抱歉，刚才的请求遇到问题。请稍后再试。',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleQuickQuestion = (q: string) => {
    setInputValue(q)
  }

  const clearHistory = () => {
    Modal.confirm({
      title: '确认清空',
      content: '确定要开始新的咨询吗？当前对话将被保存到历史记录中。',
      onOk: () => {
        startNewConsultation()
      }
    })
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-gray-50 p-4 rounded-xl">
      <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar size="large" icon={<RobotOutlined />} className="bg-blue-500" />
          <div>
            <h2 className="text-lg font-bold m-0">AI 智能医疗助手</h2>
            <span className="text-xs text-gray-500">基于大语言模型 • 仅供参考</span>
          </div>
        </div>
        <Space>
          <Button icon={<HistoryOutlined />} onClick={() => setHistoryModalVisible(true)}>历史记录</Button>
          <Button icon={<ClearOutlined />} onClick={clearHistory}>新对话</Button>
        </Space>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 px-4 space-y-6 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
              <Avatar
                icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                className={msg.role === 'user' ? 'bg-green-500 flex-shrink-0' : 'bg-blue-500 flex-shrink-0'}
              />
              <div className={`
                p-4 rounded-2xl shadow-sm text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-green-50 text-gray-800 rounded-tr-none'
                  : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}
              `}>
                {msg.role === 'assistant' ? (
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {/* 识别科室推荐并显示挂号按钮 */}
                    {msg.content.includes('推荐科室') && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => {
                            const match = msg.content.match(/推荐科室[：:]\s*([^\s\]]+)/);
                            if (match && match[1]) {
                              navigate(`/patient/appointment?department=${match[1]}`)
                            } else {
                              navigate('/patient/appointment')
                            }
                          }}
                        >
                          立即挂号
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  msg.content
                )}
                <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-green-700/60' : 'text-gray-400'}`}>
                  {moment(msg.timestamp).format('HH:mm')}
                </div>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-3 bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 items-center">
              <Avatar size="small" icon={<RobotOutlined />} className="bg-blue-500" />
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length < 2 && (
        <div className="mb-6 px-10">
          <div className="grid grid-cols-2 gap-3">
            {quickQuestions.map((q, idx) => (
              <div
                key={idx}
                className="bg-white p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-colors text-sm text-gray-600 flex items-center gap-2"
                onClick={() => handleQuickQuestion(q)}
              >
                <BulbOutlined className="text-yellow-500" /> {q}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
        <div className="flex gap-2">
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="请详细描述您的症状，例如：'我头痛三天了，伴有恶心'..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            className="resize-none border-gray-200 hover:border-blue-400 focus:border-blue-500"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            loading={loading}
            className="h-auto px-6 rounded-lg shadow-md shadow-blue-200"
          >
            发送
          </Button>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {commonSymptoms.slice(0, 8).map(sym => (
            <Tag
              key={sym}
              className="cursor-pointer hover:bg-blue-50 hover:text-blue-600 border-gray-200 transition-colors px-3 py-1"
              onClick={() => setInputValue(prev => prev ? `${prev}，${sym}` : sym)}
            >
              + {sym}
            </Tag>
          ))}
          <Tag className="cursor-pointer border-dashed" onClick={() => setSymptomModalVisible(true)}>更多...</Tag>
        </div>
      </div>

      <Modal
        title="咨询历史"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
      >
        <List
          dataSource={consultationHistory}
          renderItem={item => (
            <List.Item
              className="cursor-pointer hover:bg-gray-50 transition-colors rounded-md px-2"
              onClick={() => {
                loadHistoryConsultation(item.id)
                setHistoryModalVisible(false)
              }}
            >
              <List.Item.Meta
                avatar={<Avatar icon={<RobotOutlined />} className="bg-gray-200" />}
                title={item.title}
                description={moment(item.created_at).format('YYYY-MM-DD HH:mm')}
              />
              <Tag>{item.message_count} 条对话</Tag>
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title="选择症状"
        open={symptomModalVisible}
        onCancel={() => setSymptomModalVisible(false)}
        onOk={() => {
          const values = symptomForm.getFieldsValue()
          const selected = Object.values(values).flat().filter(Boolean)
          if (selected.length > 0) {
            setInputValue(prev => {
              const prefix = prev ? prev + '，' : ''
              return prefix + selected.join('，')
            })
          }
          setSymptomModalVisible(false)
          symptomForm.resetFields()
        }}
      >
        <Form form={symptomForm}>
          <div className="max-h-[400px] overflow-y-auto">
            {/* 简化的症状选择器，实际可按部位分类 */}
            <Form.Item name="symptoms">
              <Select mode="multiple" placeholder="请选择症状" style={{ width: '100%' }}>
                {commonSymptoms.map(s => <Option key={s} value={s}>{s}</Option>)}
              </Select>
            </Form.Item>
            <div className="text-gray-500 text-sm">
              提示：您可以直接在输入框中描述更详细的症状。
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
