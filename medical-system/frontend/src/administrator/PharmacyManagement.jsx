import React from 'react';
import { Card, Empty } from 'antd';
import { MedicineBoxOutlined } from '@ant-design/icons';

const PharmacyManagement = () => {
    return (
        <Card
            title={
                <span>
                    <MedicineBoxOutlined style={{ marginRight: 8 }} />
                    药房管理
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

export default PharmacyManagement;
