import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);

    if (!findCustomer) {
      throw new AppError('Customer does not exists !');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    if (!findProducts.length) {
      throw new AppError('Product does not exist with this id');
    }

    const productExists = findProducts.map(product => product.id);

    const checkProductExists = products.filter(
      product => !productExists.includes(product.id),
    );

    if (checkProductExists.length) {
      throw new AppError('Product not exists');
    }

    const findProductsWithoutQuantity = products.filter(
      product =>
        findProducts.filter(prod => prod.id)[0].quantity <= product.quantity,
    );

    if (findProductsWithoutQuantity.length) {
      throw new AppError('The quantity of this product not available ');
    }

    const validateProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: findProducts.filter(prod => prod.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: validateProducts,
    });

    const { order_products } = order;

    const updatedOrderProductQuantity = order_products.map(prodord => ({
      id: prodord.product_id,
      quantity:
        findProducts.filter(prod => prod.id === prodord.product_id)[0]
          .quantity - prodord.quantity,
    }));

    await this.productsRepository.updateQuantity(updatedOrderProductQuantity);

    return order;
  }
}

export default CreateOrderService;
