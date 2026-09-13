import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ffai/database';
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } from 'docx';
import sharp from 'sharp';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateQuotationDto, CreateQuotationItemDto, QuotationListQueryDto, TransitionContractDto, TransitionQuotationDto, UpdateQuotationDto, UpdateQuotationItemDto } from './dto/commercial.dto';

type ExportFormat = 'docx' | 'png';
type CommercialLine = { lineNo: number; productNo?: string | null; skuCode?: string | null; description: string; materialName?: string | null; specification?: string | null; quantity: number; unit: string; unitPrice: number; discountRate: number; amount: number; notes?: string | null };
type CommercialDocument = {
  documentType: 'QUOTATION' | 'CONTRACT'; number: string; quotationNo?: string; title: string; organizationName: string;
  customerName: string; customerNo?: string; phone?: string | null; email?: string | null; address?: string | null;
  projectName?: string | null; ownerName?: string | null; createdAt: string; validUntil?: string | null; currency: string;
  subtotal: number; discountAmount: number; taxRate: number; taxAmount: number; totalAmount: number; depositAmount?: number;
  notes?: string | null; terms?: string | null; items: CommercialLine[];
};

@Injectable()
export class CommercialService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, query: QuotationListQueryDto) {
    const scope = this.scope(user);
    const where: Prisma.QuotationWhereInput = { organizationId: user.organizationId, ...scope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { OR: [{ quotationNo: { contains: query.keyword, mode: 'insensitive' } }, { title: { contains: query.keyword, mode: 'insensitive' } }, { customer: { name: { contains: query.keyword, mode: 'insensitive' } } }] } : {}),
    };
    const [items, total, groups] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { updatedAt: 'desc' }, include: {
        customer: { select: { id: true, customerNo: true, name: true } }, project: { select: { id: true, projectNo: true, name: true } }, owner: { select: { displayName: true } }, _count: { select: { items: true } }, contract: { select: { id: true, contractNo: true, status: true } },
      } }), this.prisma.quotation.count({ where }),
      this.prisma.quotation.groupBy({ by: ['status'], where: { organizationId: user.organizationId, ...scope }, _count: true, orderBy: { status: 'asc' } }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize, summary: Object.fromEntries(groups.map(group => [group.status, group._count])) };
  }

  async detail(user: AuthUser, id: string) {
    const quotation = await this.prisma.quotation.findFirst({ where: { id, organizationId: user.organizationId, ...this.scope(user) }, include: {
      organization: { select: { code: true, name: true } }, customer: { select: { id: true, customerNo: true, name: true, phone: true, email: true, province: true, city: true, address: true } }, project: { select: { id: true, projectNo: true, name: true } },
      owner: { select: { id: true, displayName: true } }, approvedBy: { select: { displayName: true } }, contract: true,
      items: { orderBy: [{ sort: 'asc' }, { lineNo: 'asc' }], include: { product: { select: { productNo: true, name: true, materialNameCn: true, materialNameEn: true } }, sku: { select: { skuCode: true, name: true, attributes: true } } } },
    } });
    if (!quotation) throw new NotFoundException('报价单不存在或不在当前数据范围内');
    return quotation;
  }

  async create(user: AuthUser, input: CreateQuotationDto) {
    await this.assertCustomer(user, input.customerId);
    if (input.projectId) await this.assertProject(user, input.projectId);
    return this.prisma.$transaction(async tx => {
      const quotationNo = await this.nextNumber(tx, user.organizationId, 'QUOTATION');
      const { validUntil, ...data } = input;
      return tx.quotation.create({ data: { ...data, quotationNo, organizationId: user.organizationId, ownerId: user.sub, createdById: user.sub, validUntil: validUntil ? new Date(validUntil) : undefined } });
    });
  }

  async update(user: AuthUser, id: string, input: UpdateQuotationDto) {
    const quotation = await this.detail(user, id);
    this.assertDraft(quotation.status);
    const { validUntil, ...data } = input;
    await this.prisma.quotation.update({ where: { id }, data: { ...data, ...(validUntil ? { validUntil: new Date(validUntil) } : {}) } });
    await this.recalculate(id);
    return this.detail(user, id);
  }

  async addItem(user: AuthUser, quotationId: string, input: CreateQuotationItemDto) {
    const quotation = await this.detail(user, quotationId);
    this.assertDraft(quotation.status);
    if (!input.productId && !input.description) throw new BadRequestException('请选择产品或填写项目描述');
    const product = input.productId ? await this.prisma.product.findFirst({ where: { id: input.productId, organizationId: user.organizationId, deletedAt: null } }) : null;
    if (input.productId && !product) throw new BadRequestException('产品不存在');
    const sku = input.skuId ? await this.prisma.productSku.findFirst({ where: { id: input.skuId, productId: input.productId } }) : null;
    if (input.skuId && !sku) throw new BadRequestException('产品规格不存在');
    const unitPrice = new Prisma.Decimal(input.unitPrice ?? sku?.retailPrice ?? product?.retailPrice ?? 0);
    const quantity = new Prisma.Decimal(input.quantity);
    const discountRate = new Prisma.Decimal(input.discountRate ?? 0);
    const amount = quantity.mul(unitPrice).mul(new Prisma.Decimal(1).sub(discountRate)).toDecimalPlaces(2);
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quotation-item:${quotationId}`}))`;
      const max = await tx.quotationItem.aggregate({ where: { quotationId }, _max: { lineNo: true } });
      await tx.quotationItem.create({ data: {
        quotationId, lineNo: (max._max.lineNo ?? 0) + 1, productId: input.productId, skuId: input.skuId,
        description: input.description || sku?.name || product?.name || '报价项目', materialName: input.materialName || product?.materialNameCn || product?.materialNameEn,
        specification: input.specification, notes: input.notes,
        quantity, unit: input.unit || product?.unit || '项', unitPrice, discountRate, amount, sort: ((max._max.lineNo ?? 0) + 1) * 10,
      } });
    });
    await this.recalculate(quotationId);
    return this.detail(user, quotationId);
  }

  async updateItem(user: AuthUser, quotationId: string, itemId: string, input: UpdateQuotationItemDto) {
    const quotation = await this.detail(user, quotationId);
    this.assertDraft(quotation.status);
    const current = await this.prisma.quotationItem.findFirst({ where: { id: itemId, quotationId } });
    if (!current) throw new NotFoundException('报价明细不存在');
    const productId = input.productId === undefined ? current.productId : input.productId || null;
    const skuId = input.skuId === undefined ? current.skuId : input.skuId || null;
    const product = productId ? await this.prisma.product.findFirst({ where: { id: productId, organizationId: user.organizationId, deletedAt: null } }) : null;
    if (productId && !product) throw new BadRequestException('产品不存在');
    const sku = skuId ? await this.prisma.productSku.findFirst({ where: { id: skuId, productId: productId ?? undefined } }) : null;
    if (skuId && !sku) throw new BadRequestException('产品规格不存在');
    const quantity = new Prisma.Decimal(input.quantity ?? current.quantity);
    const unitPrice = new Prisma.Decimal(input.unitPrice ?? current.unitPrice);
    const discountRate = new Prisma.Decimal(input.discountRate ?? current.discountRate);
    const amount = quantity.mul(unitPrice).mul(new Prisma.Decimal(1).sub(discountRate)).toDecimalPlaces(2);
    await this.prisma.quotationItem.update({ where: { id: itemId }, data: {
      productId, skuId, description: input.description ?? current.description,
      materialName: input.materialName === undefined ? current.materialName : input.materialName || null,
      specification: input.specification === undefined ? current.specification : input.specification || null,
      notes: input.notes === undefined ? current.notes : input.notes || null,
      quantity, unit: input.unit ?? current.unit, unitPrice, discountRate, amount,
    } });
    await this.recalculate(quotationId);
    return this.detail(user, quotationId);
  }

  async deleteItem(user: AuthUser, quotationId: string, itemId: string) {
    const quotation = await this.detail(user, quotationId);
    this.assertDraft(quotation.status);
    const result = await this.prisma.quotationItem.deleteMany({ where: { id: itemId, quotationId } });
    if (!result.count) throw new NotFoundException('报价明细不存在');
    await this.recalculate(quotationId);
    return this.detail(user, quotationId);
  }

  async submit(user: AuthUser, id: string) {
    const quotation = await this.detail(user, id); this.assertDraft(quotation.status);
    if (!quotation.items.length) throw new BadRequestException('报价单至少需要一个明细');
    return this.prisma.quotation.update({ where: { id }, data: { status: 'PENDING_APPROVAL' } });
  }

  async approve(user: AuthUser, id: string) {
    const quotation = await this.detail(user, id);
    if (quotation.status !== 'PENDING_APPROVAL') throw new BadRequestException('只有待审批报价可以审批');
    return this.prisma.quotation.update({ where: { id }, data: { status: 'APPROVED', approvedById: user.sub, approvedAt: new Date() } });
  }

  async transition(user: AuthUser, id: string, input: TransitionQuotationDto) {
    const quotation = await this.detail(user, id);
    const allowed: Record<string, string[]> = { APPROVED: ['SENT'], SENT: ['ACCEPTED', 'REJECTED'] };
    if (!allowed[quotation.status]?.includes(input.status)) throw new BadRequestException(`不能从 ${quotation.status} 变更为 ${input.status}`);
    return this.prisma.quotation.update({ where: { id }, data: { status: input.status } });
  }

  async convertContract(user: AuthUser, id: string) {
    const quotation = await this.detail(user, id);
    if (quotation.status !== 'ACCEPTED') throw new BadRequestException('只有客户已接受的报价才能生成合同');
    if (quotation.contract) return quotation.contract;
    return this.prisma.$transaction(async tx => {
      const contractNo = await this.nextNumber(tx, user.organizationId, 'CONTRACT');
      const contract = await tx.contract.create({ data: {
        organizationId: user.organizationId, contractNo, quotationId: quotation.id, customerId: quotation.customerId,
        projectId: quotation.projectId, title: quotation.title.replace('报价', '合同'), totalAmount: quotation.totalAmount,
        currency: quotation.currency, terms: quotation.terms, documentSnapshot: this.toDocument(quotation, 'CONTRACT', contractNo) as unknown as Prisma.InputJsonValue, createdById: user.sub,
      } });
      await tx.quotation.update({ where: { id }, data: { status: 'CONVERTED' } });
      return contract;
    });
  }

  async transitionContract(user: AuthUser, id: string, input: TransitionContractDto) {
    const broad = user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY');
    const contract = await this.prisma.contract.findFirst({ where: { id, organizationId: user.organizationId, ...(broad ? {} : { OR: [{ quotation: { ownerId: user.sub } }, { project: { members: { some: { userId: user.sub } } } }] }) } });
    if (!contract) throw new NotFoundException('合同不存在或不在当前数据范围内');
    const allowed: Record<string, string[]> = { DRAFT: ['PENDING_SIGNATURE', 'CANCELLED'], PENDING_SIGNATURE: ['ACTIVE', 'CANCELLED'], ACTIVE: ['COMPLETED', 'CANCELLED'] };
    if (!allowed[contract.status]?.includes(input.status)) throw new BadRequestException(`不能从 ${contract.status} 变更为 ${input.status}`);
    return this.prisma.contract.update({ where: { id }, data: { status: input.status, ...(input.status === 'ACTIVE' ? { signedAt: new Date(), effectiveAt: new Date() } : {}) } });
  }

  async exportQuotation(user: AuthUser, id: string, format: ExportFormat) {
    const quotation = await this.detail(user, id);
    return this.renderExport(this.toDocument(quotation, 'QUOTATION'), format);
  }

  async exportContract(user: AuthUser, id: string, format: ExportFormat) {
    const broad = user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY');
    const contract = await this.prisma.contract.findFirst({ where: { id, organizationId: user.organizationId, ...(broad ? {} : { OR: [{ quotation: { ownerId: user.sub } }, { project: { members: { some: { userId: user.sub } } } }] }) }, include: {
      organization: { select: { name: true } }, customer: { select: { customerNo: true, name: true, phone: true, email: true, province: true, city: true, address: true } }, project: { select: { name: true } }, createdBy: { select: { displayName: true } },
      quotation: { include: { organization: { select: { code: true, name: true } }, customer: { select: { customerNo: true, name: true, phone: true, email: true, province: true, city: true, address: true } }, project: { select: { name: true } }, owner: { select: { displayName: true } }, items: { orderBy: [{ sort: 'asc' }, { lineNo: 'asc' }], include: { product: { select: { productNo: true, materialNameCn: true, materialNameEn: true } }, sku: { select: { skuCode: true } } } } } },
    } });
    if (!contract) throw new NotFoundException('合同不存在或不在当前数据范围内');
    let data: CommercialDocument;
    if (contract.documentSnapshot) {
      data = contract.documentSnapshot as unknown as CommercialDocument;
      data = { ...data, documentType: 'CONTRACT', number: contract.contractNo, title: contract.title, depositAmount: Number(contract.depositAmount), totalAmount: Number(contract.totalAmount), terms: contract.terms ?? data.terms };
    } else if (contract.quotation) {
      data = this.toDocument(contract.quotation, 'CONTRACT', contract.contractNo);
      data = { ...data, title: contract.title, depositAmount: Number(contract.depositAmount), totalAmount: Number(contract.totalAmount), terms: contract.terms ?? data.terms };
    } else {
      data = { documentType: 'CONTRACT', number: contract.contractNo, title: contract.title, organizationName: contract.organization.name, customerName: contract.customer.name, customerNo: contract.customer.customerNo, phone: contract.customer.phone, email: contract.customer.email, address: this.address(contract.customer), projectName: contract.project?.name, ownerName: contract.createdBy.displayName, createdAt: contract.createdAt.toISOString(), currency: contract.currency, subtotal: Number(contract.totalAmount), discountAmount: 0, taxRate: 0, taxAmount: 0, totalAmount: Number(contract.totalAmount), depositAmount: Number(contract.depositAmount), terms: contract.terms, items: [] };
    }
    return this.renderExport(data, format);
  }

  private toDocument(quotation: any, type: 'QUOTATION' | 'CONTRACT', number = quotation.quotationNo): CommercialDocument {
    return {
      documentType: type, number, quotationNo: type === 'CONTRACT' ? quotation.quotationNo : undefined, title: quotation.title,
      organizationName: quotation.organization?.name ?? '家具工厂 AI 系统', customerName: quotation.customer.name, customerNo: quotation.customer.customerNo,
      phone: quotation.customer.phone, email: quotation.customer.email, address: this.address(quotation.customer), projectName: quotation.project?.name,
      ownerName: quotation.owner?.displayName, createdAt: quotation.createdAt instanceof Date ? quotation.createdAt.toISOString() : quotation.createdAt,
      validUntil: quotation.validUntil instanceof Date ? quotation.validUntil.toISOString() : quotation.validUntil, currency: quotation.currency,
      subtotal: Number(quotation.subtotal), discountAmount: Number(quotation.discountAmount), taxRate: Number(quotation.taxRate), taxAmount: Number(quotation.taxAmount), totalAmount: Number(quotation.totalAmount),
      notes: quotation.notes, terms: quotation.terms,
      items: quotation.items.map((item: any) => ({
        lineNo: item.lineNo, productNo: item.product?.productNo, skuCode: item.sku?.skuCode, description: item.description,
        materialName: item.materialName || item.product?.materialNameCn || item.product?.materialNameEn, specification: item.specification,
        quantity: Number(item.quantity), unit: item.unit, unitPrice: Number(item.unitPrice), discountRate: Number(item.discountRate), amount: Number(item.amount), notes: item.notes,
      })),
    };
  }

  private address(customer: { province?: string | null; city?: string | null; address?: string | null }) {
    return [customer.province, customer.city, customer.address].filter(Boolean).join(' ');
  }

  private async renderExport(data: CommercialDocument, format: ExportFormat) {
    const extension = format === 'docx' ? 'docx' : 'png';
    const fileName = `${data.documentType === 'CONTRACT' ? '合同' : '报价单'}-${this.safeFileName(data.number)}.${extension}`;
    if (format === 'png') return { buffer: await this.renderPng(data), fileName, contentType: 'image/png' };
    return { buffer: await this.renderDocx(data), fileName, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }

  private async renderDocx(data: CommercialDocument) {
    const green = '24594A'; const pale = 'EEF5F1'; const border = { style: BorderStyle.SINGLE, size: 1, color: 'D8DED9' };
    const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
    const cell = (text: string, bold = false, fill?: string, align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT) => new TableCell({
      shading: fill ? { fill, type: ShadingType.CLEAR } : undefined, verticalAlign: VerticalAlign.CENTER,
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
      children: [new Paragraph({ alignment: align, children: [new TextRun({ text, bold, color: fill === green ? 'FFFFFF' : '1F2925', font: 'Microsoft YaHei', size: 18 })] })],
    });
    const infoRow = (a: string, b: string, c: string, d: string) => new TableRow({ children: [cell(a, true, pale), cell(b), cell(c, true, pale), cell(d)] });
    const itemRows = data.items.map((item, index) => new TableRow({
      cantSplit: true,
      children: [
        cell(String(index + 1), false, undefined, AlignmentType.CENTER),
        cell(`${item.description}${item.productNo ? `\n货号：${item.productNo}` : ''}${item.skuCode ? ` / ${item.skuCode}` : ''}`),
        cell([item.materialName, item.specification].filter(Boolean).join(' / ') || '-'),
        cell(`${this.qty(item.quantity)} ${item.unit}`, false, undefined, AlignmentType.CENTER),
        cell(`${this.money(item.unitPrice)}${item.discountRate ? `\n折扣 ${(1 - item.discountRate) * 100}%` : ''}`, false, undefined, AlignmentType.RIGHT),
        cell(this.money(item.amount), false, undefined, AlignmentType.RIGHT),
        cell(item.notes || '-'),
      ],
    }));
    const title = data.documentType === 'CONTRACT' ? '销售合同' : '产品报价单';
    const children = [
      new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.TITLE, spacing: { after: 100 }, children: [new TextRun({ text: data.organizationName, bold: true, font: 'Microsoft YaHei', size: 28, color: green })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320 }, children: [new TextRun({ text: title, bold: true, font: 'Microsoft YaHei', size: 40, color: '17231F' })] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: [
        infoRow(data.documentType === 'CONTRACT' ? '合同编号' : '报价编号', data.number, '日期', this.date(data.createdAt)),
        infoRow('客户名称', data.customerName, '联系电话', data.phone || '-'),
        infoRow('客户编号', data.customerNo || '-', '项目名称', data.projectName || '-'),
        infoRow('联系地址', data.address || '-', '有效期至', data.validUntil ? this.date(data.validUntil) : '-'),
      ] }),
      new Paragraph({ spacing: { before: 300, after: 120 }, children: [new TextRun({ text: '产品明细', bold: true, font: 'Microsoft YaHei', size: 24, color: green })] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows: [
        new TableRow({ tableHeader: true, children: ['序号', '产品名称', '材质 / 规格', '数量', '单价', '金额', '备注'].map((h) => cell(h, true, green, AlignmentType.CENTER)) }), ...itemRows,
      ] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 220 }, children: [new TextRun({ text: `产品小计：${this.money(data.subtotal)}    整单优惠：${this.money(data.discountAmount)}`, font: 'Microsoft YaHei', size: 20 })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 180 }, children: [new TextRun({ text: `税额：${this.money(data.taxAmount)}    合计：${this.money(data.totalAmount)}`, bold: true, font: 'Microsoft YaHei', size: 26, color: green })] }),
    ];
    if (data.depositAmount !== undefined) children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `合同定金：${this.money(data.depositAmount)}`, bold: true, font: 'Microsoft YaHei', size: 20 })] }));
    children.push(
      new Paragraph({ spacing: { before: 220, after: 80 }, children: [new TextRun({ text: '备注', bold: true, font: 'Microsoft YaHei', color: green })] }),
      new Paragraph({ children: [new TextRun({ text: data.notes || '无', font: 'Microsoft YaHei', size: 20 })] }),
      new Paragraph({ spacing: { before: 180, after: 80 }, children: [new TextRun({ text: '条款与说明', bold: true, font: 'Microsoft YaHei', color: green })] }),
      new Paragraph({ children: [new TextRun({ text: data.terms || '双方确认产品、材质、规格、数量及价格后执行；未尽事项由双方另行书面约定。', font: 'Microsoft YaHei', size: 20 })] }),
      new Paragraph({ spacing: { before: 420 }, children: [new TextRun({ text: `供方（盖章）：${data.organizationName}                     需方（签字/盖章）：${data.customerName}`, font: 'Microsoft YaHei', size: 20 })] }),
      new Paragraph({ spacing: { before: 180 }, children: [new TextRun({ text: `经办人：${data.ownerName || '-'}                                    签署日期：____年__月__日`, font: 'Microsoft YaHei', size: 20 })] }),
    );
    const doc = new Document({ styles: { default: { document: { run: { font: 'Microsoft YaHei', size: 20 }, paragraph: { spacing: { line: 300 } } } } }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, right: 720, bottom: 900, left: 720 } } }, children }] });
    return Packer.toBuffer(doc);
  }

  private async renderPng(data: CommercialDocument) {
    const width = 1800; const rowHeight = 175; const infoHeight = 360; const itemHeight = Math.max(1, data.items.length) * rowHeight;
    const notesHeight = 420 + this.lines(data.notes || '-', 62).length * 38 + this.lines(data.terms || '-', 62).length * 38;
    const height = 430 + infoHeight + 110 + 100 + itemHeight + 260 + notesHeight + 260;
    const esc = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const lines = (value: string | null | undefined, max: number) => this.lines(value || '-', max);
    const lineText = (values: string[], x: number, y: number, size = 30, fill = '#26332e') => values.map((value, index) => `<text x="${x}" y="${y + index * (size + 12)}" font-size="${size}" fill="${fill}">${esc(value)}</text>`).join('');
    const cols = [80, 160, 590, 900, 1090, 1280, 1490, 1720];
    const headerY = 900; const rowsY = headerY + 88;
    const itemSvg = data.items.map((item, index) => {
      const y = rowsY + index * rowHeight; const fill = index % 2 ? '#f5f8f6' : '#ffffff';
      const productLines = [...lines(item.description, 13), ...(item.productNo ? lines(`货号:${item.productNo}`, 18) : [])].slice(0, 4);
      return `<rect x="80" y="${y}" width="1640" height="${rowHeight}" fill="${fill}" stroke="#d8ded9"/>${lineText([String(index + 1)], 112, y + 54, 25)}${lineText(productLines, 180, y + 43, 23)}${lineText(lines([item.materialName, item.specification].filter(Boolean).join(' / ') || '-', 9), 610, y + 43, 23)}${lineText([`${this.qty(item.quantity)} ${item.unit}`], 930, y + 54, 24)}${lineText([this.money(item.unitPrice), item.discountRate ? `折后 ${(1 - item.discountRate) * 100}%` : ''].filter(Boolean), 1110, y + 43, 23)}${lineText([this.money(item.amount)], 1300, y + 54, 24)}${lineText(lines(item.notes, 8), 1510, y + 43, 22)}`;
    }).join('');
    const totalsY = rowsY + itemHeight + 80; const notesY = totalsY + 210;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fbfaf7"/><style>text{font-family:'Microsoft YaHei','Noto Sans CJK SC',sans-serif}</style>
      <text x="900" y="105" text-anchor="middle" font-size="34" font-weight="700" fill="#24594a">${esc(data.organizationName)}</text><text x="900" y="185" text-anchor="middle" font-size="58" font-weight="700" fill="#17231f">${data.documentType === 'CONTRACT' ? '销售合同' : '产品报价单'}</text>
      <rect x="80" y="260" width="1640" height="${infoHeight}" rx="12" fill="#fff" stroke="#d8ded9"/>${lineText([`${data.documentType === 'CONTRACT' ? '合同' : '报价'}编号：${data.number}`, `客户名称：${data.customerName}`, `联系电话：${data.phone || '-'}`, `联系地址：${data.address || '-'}`], 125, 325, 29)}${lineText([`日期：${this.date(data.createdAt)}`, `客户编号：${data.customerNo || '-'}`, `项目名称：${data.projectName || '-'}`, `有效期至：${data.validUntil ? this.date(data.validUntil) : '-'}`], 930, 325, 29)}
      <text x="80" y="790" font-size="34" font-weight="700" fill="#24594a">产品明细</text><rect x="80" y="${headerY}" width="1640" height="88" fill="#24594a"/>${['序号','产品名称','材质 / 规格','数量','单价','金额','备注'].map((h,i)=>`<text x="${cols[i]+20}" y="${headerY+56}" font-size="27" font-weight="700" fill="#fff">${h}</text>`).join('')}${itemSvg}
      <text x="1720" y="${totalsY}" text-anchor="end" font-size="28" fill="#26332e">产品小计：${esc(this.money(data.subtotal))}　整单优惠：${esc(this.money(data.discountAmount))}</text><text x="1720" y="${totalsY + 60}" text-anchor="end" font-size="38" font-weight="700" fill="#24594a">税额：${esc(this.money(data.taxAmount))}　合计：${esc(this.money(data.totalAmount))}</text>
      <text x="80" y="${notesY}" font-size="31" font-weight="700" fill="#24594a">备注</text>${lineText(lines(data.notes, 62), 80, notesY + 50, 27)}<text x="80" y="${notesY + 150}" font-size="31" font-weight="700" fill="#24594a">条款与说明</text>${lineText(lines(data.terms || '双方确认产品、材质、规格、数量及价格后执行；未尽事项由双方另行书面约定。', 62), 80, notesY + 200, 27)}
      <text x="80" y="${height - 150}" font-size="28" fill="#26332e">供方（盖章）：${esc(data.organizationName)}</text><text x="990" y="${height - 150}" font-size="28" fill="#26332e">需方（签字/盖章）：${esc(data.customerName)}</text></svg>`;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private lines(value: string, max: number) {
    if (!value) return ['-'];
    const result: string[] = [];
    for (const paragraph of value.split(/\r?\n/)) for (let index = 0; index < paragraph.length || index === 0; index += max) result.push(paragraph.slice(index, index + max) || ' ');
    return result.slice(0, 4);
  }
  private money(value: number) { return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  private qty(value: number) { return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 3 }); }
  private date(value: string) { return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)); }
  private safeFileName(value: string) { return value.replace(/[\\/:*?"<>|]/g, '-'); }

  private scope(user: AuthUser): Prisma.QuotationWhereInput {
    if (user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY')) return {};
    return { OR: [{ ownerId: user.sub }, { project: { members: { some: { userId: user.sub } } } }] };
  }
  private assertDraft(status: string) { if (status !== 'DRAFT') throw new BadRequestException('只有草稿报价可以编辑'); }
  private async assertCustomer(user: AuthUser, id: string) {
    const broad = user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY');
    const item = await this.prisma.customer.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null, ...(broad ? {} : { ownerId: user.sub }) } });
    if (!item) throw new BadRequestException('客户不存在或不在当前数据范围内');
  }
  private async assertProject(user: AuthUser, id: string) {
    const broad = user.dataScopes.includes('ALL') || user.dataScopes.includes('COMPANY');
    const item = await this.prisma.project.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null, ...(broad ? {} : { OR: [{ ownerId: user.sub }, { members: { some: { userId: user.sub } } }] }) } });
    if (!item) throw new BadRequestException('项目不存在或不在当前数据范围内');
  }
  private async recalculate(id: string) {
    const quotation = await this.prisma.quotation.findUniqueOrThrow({ where: { id }, include: { items: { select: { amount: true } } } });
    const subtotal = quotation.items.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
    const taxable = Prisma.Decimal.max(0, subtotal.sub(quotation.discountAmount));
    const taxAmount = taxable.mul(quotation.taxRate).toDecimalPlaces(2);
    await this.prisma.quotation.update({ where: { id }, data: { subtotal, taxAmount, totalAmount: taxable.add(taxAmount) } });
  }
  private async nextNumber(tx: Prisma.TransactionClient, organizationId: string, code: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${organizationId}:${code}`}))`;
    const rule = await tx.businessNumberRule.findUnique({ where: { organizationId_code: { organizationId, code } } });
    if (!rule || !rule.active) throw new NotFoundException(`业务编号规则 ${code} 不存在`);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
    const next = rule.currentDate === date ? rule.currentValue + 1 : 1;
    await tx.businessNumberRule.update({ where: { id: rule.id }, data: { currentDate: date, currentValue: next } });
    return `${rule.prefix}-${date}-${String(next).padStart(rule.sequenceLength, '0')}`;
  }
}
