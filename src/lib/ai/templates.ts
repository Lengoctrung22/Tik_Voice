export interface ScriptTemplateMeta {
  id: string;
  name: string;
  description: string;
  estimatedDuration: number;
  maxWords: number;
}

export const SCRIPT_TEMPLATE_LIST: ScriptTemplateMeta[] = [
  {
    id: 'quick_review',
    name: 'Review nhanh 30s',
    description: 'Hook mạnh 3s đầu, nêu vấn đề & chốt đơn gọn',
    estimatedDuration: 30,
    maxWords: 120,
  },
  {
    id: 'unboxing',
    name: 'Mở hộp / Unboxing',
    description: 'Kịch bản khui hộp chân thực, tạo sự háo hức',
    estimatedDuration: 45,
    maxWords: 180,
  },
  {
    id: 'comparison',
    name: 'So sánh sản phẩm',
    description: 'Đặt lên bàn cân so sánh điểm hơn thua rõ ràng',
    estimatedDuration: 45,
    maxWords: 180,
  },
  {
    id: 'top_list',
    name: 'Top lý do nên mua',
    description: 'Nhịp nhanh, liệt kê ưu điểm dứt khoát',
    estimatedDuration: 40,
    maxWords: 160,
  },
  {
    id: 'storytelling',
    name: 'Kể chuyện trải nghiệm',
    description: 'Chia sẻ câu chuyện người dùng thật, tăng tin cậy',
    estimatedDuration: 45,
    maxWords: 180,
  },
];
