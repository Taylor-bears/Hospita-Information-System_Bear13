import React from 'react';
import { Card, Empty } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

const RecordManagement = () => {
    return (
        <Card
            title={
                <span>
                    <FileTextOutlined style={{ marginRight: 8 }} />
                    病历管理
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

export default RecordManagement;
