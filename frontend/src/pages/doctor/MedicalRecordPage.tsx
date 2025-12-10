import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import api from '../../lib/api';

const { Option } = Select;

const statusOptions = [
  { label: '激活', value: 'active' },
  { label: '归档', value: 'archived' },
];

const MedicalRecordPage: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [form] = Form.useForm();

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/doctor/records/');
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      message.error('获取病例失败');
      setRecords([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      console.log('表单数据:', values);
      
      // 转换数据类型
      const payload = {
        patient_id: Number(values.patient_id),
        doctor_id: Number(values.doctor_id),
        diagnosis: values.diagnosis,
        treatment: values.treatment || '',
        status: values.status
      };
      console.log('发送数据:', payload);
      
      if (editingRecord) {
        await api.put(`/api/doctor/records/${editingRecord.id}`, payload);
        message.success('病例更新成功');
      } else {
        await api.post('/api/doctor/records/', payload);
        message.success('病例创建成功');
      }
      setModalVisible(false);
      fetchRecords();
    } catch (err) {
      console.error('错误详情:', err);
      message.error('操作失败: ' + (err as any)?.message);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id' },
    { title: '患者ID', dataIndex: 'patient_id' },
    { title: '诊断', dataIndex: 'diagnosis' },
    { title: '治疗', dataIndex: 'treatment' },
    { title: '状态', dataIndex: 'status', render: (v: string) => v === 'active' ? '激活' : '归档' },
    { title: '创建时间', dataIndex: 'created_at' },
    { title: '更新时间', dataIndex: 'updated_at' },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} type="link">编辑</Button>
      ),
    },
  ];

  return (
    <div>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 16 }}>
        新增病例
      </Button>
      <Table rowKey="id" columns={columns} dataSource={records} loading={loading} />
      <Modal
        title={editingRecord ? '编辑病例' : '新增病例'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="patient_id" label="患者ID" rules={[{ required: true, message: '请输入患者ID' }]}>
            <Input placeholder="请输入患者ID" />
          </Form.Item>
          <Form.Item name="doctor_id" label="医生ID" rules={[{ required: true, message: '请输入医生ID' }]}>
            <Input placeholder="请输入医生ID" />
          </Form.Item>
          <Form.Item name="diagnosis" label="诊断" rules={[{ required: true, message: '请输入诊断' }]}>
            <Input.TextArea placeholder="请输入诊断信息" rows={3} />
          </Form.Item>
          <Form.Item name="treatment" label="治疗">
            <Input.TextArea placeholder="请输入治疗方案（可选）" rows={3} />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select placeholder="请选择状态" options={statusOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MedicalRecordPage;
