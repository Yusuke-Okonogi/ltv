import Papa from 'papaparse';
import { OrderData, CustomerData } from '@/types/ltv';

/**
 * 列名を柔軟に検索する関数
 */
function findColumnName(
  row: Record<string, string>,
  possibleNames: string[],
  partialMatches: string[] = []
): string {
  // 完全一致を優先して検索
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
  }

  // 部分一致で検索（大文字小文字を区別しない）
  const rowKeys = Object.keys(row);
  for (const partial of partialMatches) {
    const foundKey = rowKeys.find(
      key => key.toLowerCase().includes(partial.toLowerCase())
    );
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
      return row[foundKey];
    }
  }

  return '';
}

/**
 * CSVファイルをパースしてOrderData配列に変換
 */
export function parseCSV(csvText: string): OrderData[] {
  const results = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (results.errors.length > 0) {
    console.warn('CSV parsing errors:', results.errors);
  }

  // デバッグ: 利用可能な列名をログ出力
  if (results.data.length > 0) {
    const firstRow = results.data[0];
    const availableColumns = Object.keys(firstRow);
    console.log('利用可能なCSV列名:', availableColumns);
  }

  const orders: OrderData[] = [];

  // 最初の行から列名を自動検出
  let dateColumn = '';
  let customerIdColumn = '';
  let amountColumn = '';

  if (results.data.length > 0) {
    const firstRow = results.data[0];
    const availableColumns = Object.keys(firstRow);

    // 日付列の検出
    dateColumn = availableColumns.find(col => 
      /注文日|購入日|日付|date|order.*date|受注日/i.test(col)
    ) || '';

    // 顧客ID列の検出
    customerIdColumn = availableColumns.find(col => 
      /会員ID|顧客ID|購入者ID|ユーザーID|member.*id|customer.*id|user.*id|購入者コード/i.test(col)
    ) || '';

    // 金額列の検出
    amountColumn = availableColumns.find(col => 
      /金額|合計|支払|amount|total|price|価格|売上/i.test(col) &&
      !/税|tax|ポイント|point|送料|shipping/i.test(col)
    ) || '';
  }

  results.data.forEach((row, index) => {
    // 列名が検出された場合はそれを使用、そうでない場合は柔軟な検索
    let orderDate = '';
    let customerId = '';
    let amountStr = '';

    if (dateColumn && row[dateColumn]) {
      orderDate = row[dateColumn];
    } else {
      orderDate = findColumnName(
        row,
        ['注文日', '注文日時', '購入日', '日付', 'order_date', 'Order Date', 'date', '受注日', '受注日時'],
        ['注文', '日付', 'date', '購入', '受注']
      );
    }

    if (customerIdColumn && row[customerIdColumn]) {
      customerId = row[customerIdColumn];
    } else {
      customerId = findColumnName(
        row,
        ['顧客ID', '会員ID', 'ユーザーID', '購入者ID', 'customer_id', 'Customer ID', 'user_id', 'member_id', 'Member ID', '購入者コード'],
        ['会員', '顧客', 'customer', 'member', 'user', '購入者']
      );
    }

    if (amountColumn && row[amountColumn]) {
      amountStr = row[amountColumn];
    } else {
      amountStr = findColumnName(
        row,
        ['金額', '合計金額', '支払金額', 'amount', 'Amount', 'total', 'Total', '合計', '支払額', '売上金額'],
        ['金額', '合計', 'amount', 'total', '支払', '売上']
      ) || '0';
    }

    // 金額を数値に変換（カンマや円記号を除去）
    const amount = parseFloat(
      amountStr.toString().replace(/[¥,円\s]/g, '').trim()
    ) || 0;

    // デバッグ: 最初の数行のデータをログ出力
    if (index < 3) {
      console.log(`行 ${index + 1}:`, {
        orderDate,
        customerId,
        amountStr,
        amount,
        rawRow: row
      });
    }

    // 必須項目のチェックを緩和（顧客IDが空の場合は注文番号などで代替を試みる）
    if (!customerId) {
      // 注文番号やその他の識別子を試す
      const orderIdColumn = Object.keys(row).find(col => 
        /注文番号|order.*no|order.*id|受注番号/i.test(col)
      );
      if (orderIdColumn) {
        customerId = `ORDER-${row[orderIdColumn]}`;
      }
    }

    if (orderDate && amount > 0) {
      // 日付形式を正規化（YYYY-MM-DD形式に変換）
      const normalizedDate = normalizeDate(orderDate);
      
      // 顧客IDが空の場合は、注文日と金額の組み合わせで一意のIDを生成
      const finalCustomerId = customerId || `ANONYMOUS-${normalizedDate}-${amount}`;
      
      orders.push({
        orderDate: normalizedDate,
        customerId: finalCustomerId.trim(),
        amount: amount,
      });
    }
  });

  // データが見つからない場合の詳細なエラーメッセージ
  if (orders.length === 0 && results.data.length > 0) {
    const firstRow = results.data[0];
    const availableColumns = Object.keys(firstRow);
    console.error('データが見つかりませんでした。利用可能な列名:', availableColumns);
    console.error('検出された列名:', {
      dateColumn,
      customerIdColumn,
      amountColumn
    });
  }

  return orders;
}

/**
 * 日付文字列をYYYY-MM-DD形式に正規化
 */
function normalizeDate(dateStr: string): string {
  // 既にYYYY-MM-DD形式の場合はそのまま返す
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // YYYY/MM/DD形式を変換
  if (/^\d{4}\/\d{2}\/\d{2}/.test(dateStr)) {
    return dateStr.replace(/\//g, '-').split(' ')[0].split('T')[0];
  }

  // YYYY-MM-DD HH:MM:SS形式を変換
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(dateStr)) {
    return dateStr.split(' ')[0];
  }

  // YYYY/MM/DD HH:MM:SS形式を変換
  if (/^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}/.test(dateStr)) {
    return dateStr.replace(/\//g, '-').split(' ')[0];
  }

  // MM/DD/YYYY形式を変換
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    const parts = dateStr.split('/');
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`.split(' ')[0];
  }

  // Dateオブジェクトでパースを試みる
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // パースできない場合はそのまま返す
  return dateStr;
}

/**
 * OrderData配列からCustomerData配列に変換
 */
export function convertOrdersToCustomers(orders: OrderData[]): CustomerData[] {
  const customerMap = new Map<string, {
    customerId: string;
    orders: OrderData[];
    acquisitionDate: string;
    lastPurchaseDate: string;
  }>();

  orders.forEach(order => {
    const existing = customerMap.get(order.customerId) || {
      customerId: order.customerId,
      orders: [],
      acquisitionDate: order.orderDate,
      lastPurchaseDate: order.orderDate,
    };

    existing.orders.push(order);
    
    // 最初の購入日を取得
    if (order.orderDate < existing.acquisitionDate) {
      existing.acquisitionDate = order.orderDate;
    }
    
    // 最後の購入日を取得
    if (order.orderDate > existing.lastPurchaseDate) {
      existing.lastPurchaseDate = order.orderDate;
    }

    customerMap.set(order.customerId, existing);
  });

  const customers: CustomerData[] = Array.from(customerMap.values()).map(customer => ({
    customerId: customer.customerId,
    acquisitionDate: customer.acquisitionDate,
    totalRevenue: customer.orders.reduce((sum, order) => sum + order.amount, 0),
    purchaseCount: customer.orders.length,
    lastPurchaseDate: customer.lastPurchaseDate,
  }));

  return customers;
}
