import React, { useState } from 'react'
import { Card, Row, Col, Typography, Button, Input, Space, List, Avatar, Tag, Modal, Form, InputNumber, Badge, message, Divider, Select } from 'antd'
import { SearchOutlined, ShoppingCartOutlined, PlusOutlined, MinusOutlined, DeleteOutlined, MedicineBoxOutlined, StarOutlined, FilterOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { drugAPI, orderAPI } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Search } = Input
const { Option } = Select

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  isPrescription: boolean
  specification: string
  manufacturer: string
}

export default function OnlinePharmacy() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [searchText, setSearchText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [cartVisible, setCartVisible] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderModalVisible, setOrderModalVisible] = useState(false)
  const [orderForm] = Form.useForm()

  // 获取药品列表
  const { data: drugs, isLoading } = useQuery({
    queryKey: ['drugs', searchText, selectedCategory],
    queryFn: async () => {
      const { data, error } = await drugAPI.getDrugs({
        keyword: searchText || undefined,
        category: selectedCategory || undefined,
        pageSize: 100
      })
      if (error) throw error
      return data || []
    }
  })

  // 获取药品分类
  const { data: categories } = useQuery({
    queryKey: ['drug-categories'],
    queryFn: async () => {
      const { data, error } = await drugAPI.getDrugs({ pageSize: 1000 })
      if (error) throw error
      
      const cats = [...new Set(data?.map((drug: any) => drug.category).filter(Boolean))]
      return cats || []
    }
  })

  // 创建订单
  const createOrderMutation = useMutation({
    mutationFn: async (values: any) => {
      const orderItems = cart.map(item => ({
        drug_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
        instructions: values.instructions
      }))

      const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0)

      const orderData = {
        patient_id: user?.id,
        order_number: `ORD${Date.now()}`,
        order_type: cart.some(item => item.isPrescription) ? 'prescription' : 'otc',
        total_amount: totalAmount,
        status: 'pending',
        delivery_type: values.deliveryType,
        payment_method: values.paymentMethod,
        notes: values.notes,
        order_items: orderItems
      }

      const { data, error } = await orderAPI.createOrder(orderData)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      message.success('订单提交成功！')
      setCart([])
      setOrderModalVisible(false)
      orderForm.resetFields()
      navigate('/patient/orders')
    },
    onError: (error: any) => {
      message.error(error.message || '订单提交失败')
    }
  })

  const addToCart = (drug: any) => {
    const existingItem = cart.find(item => item.id === drug.id)
    
    if (existingItem) {
      updateQuantity(drug.id, existingItem.quantity + 1)
    } else {
      const newItem: CartItem = {
        id: drug.id,
        name: drug.name,
        price: drug.price,
        quantity: 1,
        isPrescription: drug.is_prescription,
        specification: drug.specification,
        manufacturer: drug.manufacturer
      }
      setCart([...cart, newItem])
      message.success(`${drug.name} 已添加到购物车`)
    }
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id)
      return
    }
    
    setCart(cart.map(item => 
      item.id === id ? { ...item, quantity } : item
    ))
  }

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const handleOrderSubmit = (values: any) => {
    if (cart.length === 0) {
      message.warning('购物车为空')
      return
    }
    createOrderMutation.mutate(values)
  }

  const hasPrescriptionDrugs = cart.some(item => item.isPrescription)

  return (
    <div className="p-6">
      <div className="mb-6">
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} className="!mb-2">在线购药</Title>
            <Text type="secondary">便捷的药品购买服务，支持处方药和非处方药</Text>
          </Col>
          <Col>
            <Badge count={cart.length} showZero>
              <Button 
                type="primary" 
                icon={<ShoppingCartOutlined />}
                onClick={() => setCartVisible(true)}
                size="large"
              >
                购物车
              </Button>
            </Badge>
          </Col>
        </Row>
      </div>

      {/* 搜索和筛选 */}
      <Card className="mb-6">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} lg={8}>
            <Search
              placeholder="搜索药品名称、症状"
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={(value) => setSearchText(value)}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Select
              placeholder="选择分类"
              style={{ width: '100%' }}
              value={selectedCategory}
              onChange={setSelectedCategory}
              allowClear
              size="large"
            >
              {categories?.map((category: string) => (
                <Option key={category} value={category}>
                  <Space>
                    <FilterOutlined />
                    {category}
                  </Space>
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button 
              type="default" 
              size="large"
              onClick={() => {
                setSearchText('')
                setSelectedCategory('')
              }}
            >
              重置筛选
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 药品列表 */}
      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }}
        loading={isLoading}
        dataSource={drugs || []}
        renderItem={(drug: any) => (
          <List.Item>
            <Card 
              hoverable
              cover={
                <div className="h-32 bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center">
                  <MedicineBoxOutlined className="text-4xl text-blue-500" />
                </div>
              }
              actions={[
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => addToCart(drug)}
                  block
                  size="small"
                >
                  加入购物车
                </Button>
              ]}
            >
              <Card.Meta
                title={
                  <div>
                    <Text strong className="text-lg">{drug.name}</Text>
                    {drug.is_prescription && (
                      <Tag color="red" className="ml-2">处方药</Tag>
                    )}
                  </div>
                }
                description={
                  <div>
                    <Text type="secondary" className="block mb-1">
                      {drug.specification}
                    </Text>
                    <Text type="secondary" className="block mb-2 text-sm">
                      {drug.manufacturer}
                    </Text>
                    <div className="flex justify-between items-center">
                      <Text strong className="text-xl text-red-500">
                        ¥{drug.price?.toFixed(2)}
                      </Text>
                      <Tag color="blue">{drug.category}</Tag>
                    </div>
                  </div>
                }
              />
            </Card>
          </List.Item>
        )}
      />

      {/* 购物车抽屉 */}
      <Modal
        title="购物车"
        visible={cartVisible}
        onCancel={() => setCartVisible(false)}
        footer={null}
        width={600}
      >
        {cart.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCartOutlined className="text-6xl text-gray-300 mb-4" />
            <Text type="secondary">购物车为空</Text>
          </div>
        ) : (
          <div>
            <List
              dataSource={cart}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button 
                      type="text" 
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeFromCart(item.id)}
                    />
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<MedicineBoxOutlined />} />}
                    title={
                      <div>
                        <Text strong>{item.name}</Text>
                        {item.isPrescription && <Tag color="red" className="ml-2">处方药</Tag>}
                      </div>
                    }
                    description={
                      <div>
                        <Text type="secondary" className="block">{item.specification}</Text>
                        <Text type="secondary" className="block text-sm">{item.manufacturer}</Text>
                        <Text strong className="text-red-500">¥{item.price?.toFixed(2)}</Text>
                      </div>
                    }
                  />
                  <div>
                    <Space>
                      <Button 
                        size="small" 
                        icon={<MinusOutlined />}
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      />
                      <span className="mx-2">{item.quantity}</span>
                      <Button 
                        size="small" 
                        icon={<PlusOutlined />}
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      />
                    </Space>
                    <br />
                    <Text strong className="text-lg text-red-500">
                      ¥{(item.price * item.quantity).toFixed(2)}
                    </Text>
                  </div>
                </List.Item>
              )}
            />
            
            <Divider />
            
            <div className="text-right mb-4">
              <Text className="text-lg">总计：</Text>
              <Text strong className="text-2xl text-red-500">¥{getTotalPrice().toFixed(2)}</Text>
            </div>
            
            <div className="text-center">
              <Button 
                type="primary" 
                size="large"
                onClick={() => {
                  setCartVisible(false)
                  setOrderModalVisible(true)
                }}
                block
              >
                去结算
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 订单确认模态框 */}
      <Modal
        title="确认订单"
        visible={orderModalVisible}
        onCancel={() => setOrderModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={orderForm}
          layout="vertical"
          onFinish={handleOrderSubmit}
        >
          {hasPrescriptionDrugs && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Text strong className="text-yellow-800">
                ⚠️ 处方药提醒
              </Text>
              <Text className="text-yellow-700 block mt-1">
                您的订单包含处方药，请确保您有有效的处方。如有疑问，请联系客服。
              </Text>
            </div>
          )}

          <Form.Item
            label="配送方式"
            name="deliveryType"
            rules={[{ required: true, message: '请选择配送方式' }]}
            initialValue="pickup"
          >
            <Select>
              <Option value="pickup">到店自取</Option>
              <Option value="delivery">快递配送</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="支付方式"
            name="paymentMethod"
            rules={[{ required: true, message: '请选择支付方式' }]}
            initialValue="wechat"
          >
            <Select>
              <Option value="wechat">微信支付</Option>
              <Option value="alipay">支付宝</Option>
              <Option value="card">银行卡</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="用药说明"
            name="instructions"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="如有特殊用药说明，请在此填写"
            />
          </Form.Item>

          <Form.Item
            label="备注信息"
            name="notes"
          >
            <Input.TextArea 
              rows={2} 
              placeholder="其他需要说明的信息（可选）"
            />
          </Form.Item>

          <Divider />

          <div className="mb-4">
            <Title level={5}>订单明细</Title>
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center py-2">
                <div>
                  <Text strong>{item.name}</Text>
                  <Text type="secondary" className="block text-sm">
                    {item.specification} × {item.quantity}
                  </Text>
                </div>
                <Text strong>¥{(item.price * item.quantity).toFixed(2)}</Text>
              </div>
            ))}
          </div>

          <div className="text-right mb-4">
            <Text className="text-lg">总计：</Text>
            <Text strong className="text-2xl text-red-500">¥{getTotalPrice().toFixed(2)}</Text>
          </div>

          <Form.Item className="mb-0">
            <Space className="w-full">
              <Button 
                onClick={() => setOrderModalVisible(false)}
                className="flex-1"
              >
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={createOrderMutation.isPending}
                className="flex-1"
              >
                提交订单
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
