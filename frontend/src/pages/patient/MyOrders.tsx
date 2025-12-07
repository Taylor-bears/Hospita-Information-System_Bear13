import React, { useState } from 'react'
import ErrorBoundary from '../../components/ErrorBoundary'
import { Card, Table, Tag, Button, Space, Modal, Form, DatePicker, Select, message, Descriptions, List, Row, Col } from 'antd'
import { EyeOutlined, ShoppingCartOutlined, DollarOutlined, TruckOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { getOrderStatusColor, getOrderStatusText, getPaymentStatusColor, getPaymentStatusText, getDeliveryTypeText } from '../../lib/status'
import { useMyOrders } from '../../data/orders'
import { useAuthStore } from '../../stores/authStore'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

const MyOrders: React.FC = () => {
  const { user } = useAuthStore()
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  const { data: orders = [], isLoading, refetch } = useMyOrders(user?.id)

  

  const columns = [
    {
      title: '订单编号',
      dataIndex: 'order_number',
      key: 'order_number',
      width: 150,
    },
    {
      title: '订单信息',
      key: 'order_info',
      render: (record: any) => (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
            共 {record.order_items?.length || 0} 件商品
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {record.order_items?.slice(0, 2).map((item: any, index: number) => (
              <div key={index}>
                {item.drug?.name} × {item.quantity}
              </div>
            ))}
            {record.order_items?.length > 2 && (
              <div style={{ color: '#1890ff' }}>...等{record.order_items.length - 2}件</div>
            )}
          </div>
        </div>
      ),
      width: 200,
    },
    {
      title: '订单金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 100,
      render: (amount: number) => (
        <div style={{ fontWeight: 'bold', color: '#ff4d4f' }}>
          ¥{amount?.toFixed(2)}
        </div>
      ),
    },
    {
      title: '配送方式',
      dataIndex: 'delivery_type',
      key: 'delivery_type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'express' ? 'red' : 'blue'}>
          {getDeliveryTypeText(type)}
        </Tag>
      ),
    },
    {
      title: '订单状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
          <Tag color={getOrderStatusColor(status)}>
          {getOrderStatusText(status)}
          </Tag>
      ),
    },
    {
      title: '支付状态',
      dataIndex: 'payment_status',
      key: 'payment_status',
      width: 100,
      render: (status: string) => (
          <Tag color={getPaymentStatusColor(status)}>
          {getPaymentStatusText(status)}
          </Tag>
      ),
    },
    {
      title: '下单时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (record: any) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedOrder(record)
              setDetailModalVisible(true)
            }}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <ErrorBoundary>
    <div className="p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>我的订单</h2>
        <Button onClick={() => refetch()} loading={isLoading}>刷新</Button>
      </div>
      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <span>时间范围：</span>
            <RangePicker
              style={{ width: 240 }}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
          <Col>
            <span>订单状态：</span>
            <Select
              style={{ width: 120 }}
              allowClear
              placeholder="全部状态"
            >
              <Select.Option value="pending">待确认</Select.Option>
              <Select.Option value="confirmed">已确认</Select.Option>
              <Select.Option value="processing">处理中</Select.Option>
              <Select.Option value="shipped">已发货</Select.Option>
              <Select.Option value="delivered">已送达</Select.Option>
              <Select.Option value="cancelled">已取消</Select.Option>
            </Select>
          </Col>
          <Col>
            <span>支付状态：</span>
            <Select
              style={{ width: 120 }}
              allowClear
              placeholder="全部状态"
            >
              <Select.Option value="pending">待支付</Select.Option>
              <Select.Option value="paid">已支付</Select.Option>
              <Select.Option value="failed">支付失败</Select.Option>
            </Select>
          </Col>
          <Col>
            <Button type="primary">搜索</Button>
          </Col>
        </Row>
      </Card>

      {/* 订单列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          locale={{ emptyText: '暂无订单记录' }}
        />
      </Card>

      {/* 订单详情模态框 */}
      <Modal
        title="订单详情"
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedOrder && (
          <div>
            <Card title="订单信息" style={{ marginBottom: 16 }}>
              <Descriptions column={2}>
                <Descriptions.Item label="订单编号">{selectedOrder.order_number}</Descriptions.Item>
                <Descriptions.Item label="订单状态">
                  <Tag color={getOrderStatusColor(selectedOrder.status)}>
                    {getOrderStatusText(selectedOrder.status)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="订单金额">
                  <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                    ¥{selectedOrder.total_amount?.toFixed(2)}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="支付状态">
                  <Tag color={getPaymentStatusColor(selectedOrder.payment_status)}>
                    {getPaymentStatusText(selectedOrder.payment_status)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="配送方式">
                  <Tag color={selectedOrder.delivery_type === 'express' ? 'red' : 'blue'}>
                    {getDeliveryTypeText(selectedOrder.delivery_type)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="下单时间">
                  {dayjs(selectedOrder.created_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              </Descriptions>
              
              {selectedOrder.notes && (
                <Descriptions column={1} style={{ marginTop: 16 }}>
                  <Descriptions.Item label="订单备注">{selectedOrder.notes}</Descriptions.Item>
                </Descriptions>
              )}
            </Card>

            <Card title="收货信息" style={{ marginBottom: 16 }}>
              <Descriptions column={2}>
                <Descriptions.Item label="收货人">{selectedOrder.receiver_name}</Descriptions.Item>
                <Descriptions.Item label="联系电话">{selectedOrder.receiver_phone}</Descriptions.Item>
                <Descriptions.Item label="收货地址" span={2}>
                  {selectedOrder.receiver_address}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="商品清单" style={{ marginBottom: 16 }}>
              <List
                dataSource={selectedOrder.order_items || []}
                renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.drug?.name}
                      description={
                        <div>
                          <div>规格：{item.drug?.specification}</div>
                          <div>生产厂家：{item.drug?.manufacturer}</div>
                          <div style={{ marginTop: 8 }}>
                            <Space>
                              <span>单价：¥{item.unit_price?.toFixed(2)}</span>
                              <span>数量：{item.quantity}</span>
                              <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                                小计：¥{(item.quantity * item.unit_price)?.toFixed(2)}
                              </span>
                            </Space>
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
              <div style={{ textAlign: 'right', marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#ff4d4f' }}>
                  订单总计：¥{selectedOrder.total_amount?.toFixed(2)}
                </div>
              </div>
            </Card>

            {selectedOrder.tracking_number && (
              <Card title="物流信息">
                <Descriptions column={1}>
                  <Descriptions.Item label="快递公司">{selectedOrder.shipping_company}</Descriptions.Item>
                  <Descriptions.Item label="快递单号">{selectedOrder.tracking_number}</Descriptions.Item>
                  {selectedOrder.shipped_at && (
                    <Descriptions.Item label="发货时间">
                      {dayjs(selectedOrder.shipped_at).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                  )}
                  {selectedOrder.delivered_at && (
                    <Descriptions.Item label="送达时间">
                      {dayjs(selectedOrder.delivered_at).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
    </ErrorBoundary>
  )
}

export default MyOrders
