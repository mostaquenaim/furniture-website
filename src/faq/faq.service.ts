import { Injectable } from '@nestjs/common';

export interface Faq {
  id: number;
  category: string;
  question: string;
  answer: string;
}

@Injectable()
export class FaqService {
  private readonly faqs: Faq[] = [
    {
      id: 1,
      category: 'Delivery & Tracking',
      question: 'When will I receive my delivery?',
      answer:
        'Once your order is confirmed, delivery usually takes 3 to 10 working days. The exact time depends on the product and your location — deliveries within the city are typically faster, while remote areas may take a bit longer.',
    },
    {
      id: 2,
      category: 'Delivery & Tracking',
      question: 'How can I track my order?',
      answer:
        "You can track your order anytime from your account dashboard. You're also welcome to call our support hotline with your order number, and we'll update you on the status.",
    },
    {
      id: 3,
      category: 'Delivery & Tracking',
      question: 'How much does delivery cost?',
      answer:
        "Delivery charges depend on your location, along with the product's size, weight, and volume. Larger furniture pieces may have an additional charge, including a possible floor delivery fee. We'll always confirm the exact delivery cost with you before your order is finalized.",
    },
    {
      id: 4,
      category: 'Payment',
      question: 'Do you offer Cash on Delivery?',
      answer: 'Yes, Cash on Delivery is available on our store.',
    },
    {
      id: 5,
      category: 'Payment',
      question: 'Can I pay in installments (EMI)?',
      answer: "We don't currently offer EMI or installment payment options.",
    },
    {
      id: 6,
      category: 'Product Info',
      question: 'How do I know if a product will fit my space?',
      answer:
        'Every product page includes detailed measurements — length, width, and height — along with material and color information, so you can be confident about the fit before you order.',
    },
    {
      id: 7,
      category: 'Product Info',
      question: 'Can I request a custom-made product?',
      answer: "At the moment, we don't offer custom orders.",
    },
    {
      id: 8,
      category: 'Returns & Warranty',
      question: 'Is there a warranty on products?',
      answer:
        "We don't offer a standard warranty. However, if your product arrives with a manufacturing defect, we'll replace it for you.",
    },
    {
      id: 9,
      category: 'Returns & Warranty',
      question: 'Can I return or exchange a product?',
      answer:
        "If you change your mind, you can exchange your product for a different one of the same price or higher within 7 days of delivery. Please note we don't offer cash refunds. If the new product costs more, you'll just need to pay the difference.",
    },
    {
      id: 10,
      category: 'Returns & Warranty',
      question: 'What if my product arrives damaged?',
      answer:
        'Please check your parcel at the time of delivery. If you notice any damage, let us know right away. Having a photo or video of the damage along with your order number will help us resolve it quickly.',
    },
    {
      id: 11,
      category: 'Shopping & Offers',
      question: 'Can I see the product in person before buying?',
      answer:
        "We currently don't have a physical store, so all our products are available to browse and purchase online. We've made sure our product photos and details are as clear as possible to help you choose confidently.",
    },
    {
      id: 12,
      category: 'Shopping & Offers',
      question: 'Do you have any ongoing offers or discounts?',
      answer:
        "Yes! We regularly run seasonal offers, bundle discounts, first-order deals, and special festival campaigns. Keep an eye on our website and social page so you don't miss out.",
    },
    {
      id: 13,
      category: 'Shopping & Offers',
      question: 'Do you take corporate or bulk orders?',
      answer:
        "At this time, we're not accepting bulk orders for offices, hotels, restaurants, or large projects.",
    },
  ];

  getAll(): Faq[] {
    return this.faqs;
  }
}
