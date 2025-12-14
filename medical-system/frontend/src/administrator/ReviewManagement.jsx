import React from 'react';
import { Card, Empty } from 'antd';
import { StarOutlined } from '@ant-design/icons';

const ReviewManagement = () => {
    return (
        <Card
            title={
                <span>
                    <StarOutlined style={{ marginRight: 8 }} />
                    医生评价系统
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

export default ReviewManagement;
