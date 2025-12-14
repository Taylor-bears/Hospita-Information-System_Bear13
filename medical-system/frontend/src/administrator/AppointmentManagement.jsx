import React from 'react';
import { Card, Empty } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';

const AppointmentManagement = () => {
    return (
        <Card
            title={
                <span>
                    <CalendarOutlined style={{ marginRight: 8 }} />
                    预约管理
                </span>
            }
            bordered={false}
            style={{ borderRadius: 8 }}
        >
            <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="该模块正在开发中..."
                style={{ padding: '60px 0' }}
            />
        </Card>
    );
};

export default AppointmentManagement;
