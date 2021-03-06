import React, {
  Fragment,
  useState,
  useCallback,
  useEffect,
  useRef
} from 'react';
import { useDispatch, useMappedState } from 'redux-react-hook';
import Modal from 'react-modal';
import get from 'lodash.get';
import find from 'lodash.find';
import uuidv1 from 'uuid/v1';
import moment from 'moment';
import request from '../common/api/request';
import { toast } from '../common/components/Toastify';
import Icon from '../common/components/Icon';

import * as actionTypes from '../common/store/actionTypes';
import * as styled from './index.styled';
import * as commonStyle from '../common/styles/common';

Modal.setAppElement('#root');

/**
 * 顾客账单
 * @param  {{leftButton: JSX.Element, readonly: Boolean}} {}
 */
function SaleBlock({ leftButton, readonly }) {
  // 模态框
  const [modalIsOpen, setModalIsOpen] = useState(false);
  // 删除按钮
  const [deleteBtnIsShow, setDeleteBtnIsShow] = useState({});
  // 条形码
  const [barcode, setBarcode] = useState('');
  // 条形码输入框
  const barInputEl = useRef(null);

  // map state
  const {
    customerList,
    currentCustomer,
    currentCustomerId,
    cartItems,
    giftsIsShow,
    inputMethod
  } = useMappedState(
    useCallback((state) => {
      const customerList = get(state, 'customer', []);
      // 当前顾客
      const currentCustomer = find(customerList, ['isCurrent', true]) || {};
      // 当前顾客 ID
      const currentCustomerId = get(currentCustomer, 'id', '');

      // 当前购物车
      const currentCart = get(state, `cart[${currentCustomerId}]`, {});
      // 商品
      const cartItems = get(currentCart, 'items', []);
      // 展示礼品卡
      const giftsIsShow = get(state, 'gift.isShow', false);
      // 输入方式
      const inputMethod = get(state, 'scanner.inputMethod', 'barcode');

      return {
        customerList,
        currentCustomer,
        currentCustomerId,
        cartItems,
        giftsIsShow,
        inputMethod
      };
    }, [])
  );

  useEffect(() => {
    const handleBarcodeInputBlur = () => {
      barInputEl.current.focus();

      setBarcode('');
    };

    if (readonly) {
      barInputEl.current.removeEventListener(
        'blur',
        handleBarcodeInputBlur,
        false
      );
    } else if (inputMethod === 'barcode') {
      barInputEl.current.focus();
      barInputEl.current.addEventListener(
        'blur',
        handleBarcodeInputBlur,
        false
      );
    } else {
      barInputEl.current.removeEventListener(
        'blur',
        handleBarcodeInputBlur,
        false
      );
    }

    return () => {
      barInputEl.current.removeEventListener(
        'blur',
        handleBarcodeInputBlur,
        false
      );
    };
  }, [inputMethod, barInputEl, readonly]);

  // actions
  const dispatch = useDispatch();

  // 设置当前顾客/账单
  const setCustomer = (id) => {
    dispatch({
      type: actionTypes.SET_CURRENT_CUSTOMER,
      payload: id
    });

    setModalIsOpen(false);
  };

  // 添加顾客/账单
  const addCustomer = useCallback(() => {
    const newCustomer = {
      id: uuidv1(),
      name: '自定义账单',
      info: moment().format('hh:mm:ss a'),
      isCurrent: true
    };

    dispatch({
      type: actionTypes.ADD_CUSTOMER,
      payload: newCustomer
    });

    setCustomer(newCustomer.id);

    setModalIsOpen(false);
  }, []);

  /**
   * 删除商品
   */
  const deleteProductItem = (id) => {
    return () => {
      dispatch({
        type: actionTypes.DELETE_PRODUCT_ITEM,
        payload: {
          itemId: id,
          customerId: currentCustomerId
        }
      });
    };
  };

  /**
   * 模态框
   */
  const handleModalIsOpen = (e) => {
    e.target.id !== 'addButton' && setModalIsOpen(true);
  };

  /**
   * 删除顾客/账单
   */
  const deleteCustomer = useCallback(() => {
    currentCustomerId &&
      dispatch({
        type: actionTypes.DELETE_CUSTOMER,
        payload: currentCustomerId
      });
  }, [currentCustomerId]);

  /**
   * 添加优惠折扣
   */
  const handleGiftsShow = useCallback(() => {
    dispatch({
      type: actionTypes.HANDLE_GIFTS_SHOW,
      payload: !giftsIsShow
    });
  });

  /**
   * 添加商品
   * @param  {Object} productItem
   */
  const handleAddProductItem = (productItem) => {
    if (!currentCustomerId) return;

    dispatch({
      type: actionTypes.ADD_PRODUCT_ITEM,
      payload: {
        id: currentCustomerId,
        item: productItem
      }
    });

    setBarcode('');
  };

  /**
   * 扫描条形码输入
   */
  const handleBarcodeChange = async (e) => {
    e.stopPropagation();
    const keyCode = e.keyCode;

    if (keyCode !== 13 || !barcode || barcode.length < 10 || readonly) return;

    try {
      const fetchData = await request({ url: `/products/${barcode.trim()}` });

      await handleAddProductItem(fetchData[0]);
    } catch (e) {
      toast.warn('未查询到该商品！');
    }
  };

  // 自定义税率，应从服务器获取，这里固定为 0
  const taxRate = 0;

  // 总金额
  const amount = cartItems.reduce((acc, cur) => {
    if (cur.itemType === 'item') return acc + parseFloat(cur.itemPrice || 0, 2);
    return 0;
  }, 0);

  // 总折扣
  const discountAmount = cartItems
    .map((item) => {
      if (item.itemType !== 'gift') return 0;

      if (item.itemPrice) return parseFloat(item.itemPrice);

      if (item.discountRate) return amount * parseFloat(1 - item.discountRate);

      return 0;
    })
    .reduce((acc, cur) => acc + cur, 0)
    .toFixed(2);

  // 实际金额 realAmount = (amount - discountAmount) * (1 - taxRate)
  const realAmount = (
    (parseFloat(amount) - parseFloat(discountAmount) >= 0
      ? parseFloat(amount) - parseFloat(discountAmount)
      : 0) *
    (1 - taxRate)
  ).toFixed(2);

  return (
    <Fragment>
      <styled.SaleBlock>
        {/* head */}
        <styled.Head>
          {leftButton ? (
            leftButton
          ) : (
            <Icon
              name="icon_delete_black"
              width="0.22"
              height="0.22"
              onClick={deleteCustomer}
            />
          )}
          <styled.Title>账单</styled.Title>
          <Icon
            name="icon_more_black"
            width="0.22"
            height="0.22"
            onClick={() => setModalIsOpen(true)}
          />
        </styled.Head>

        {/* body */}
        <styled.Body>
          {/* Customer */}
          <styled.Customer onClick={handleModalIsOpen}>
            <Icon name="icon_user_c_gray" width="0.2" height="0.2" />
            <styled.CustomerId>
              {currentCustomer.name ? `${currentCustomer.name}` : '添加账单'}
            </styled.CustomerId>
            {!readonly && (
              <styled.EnhanceIcon
                name="icon_add_c_gray"
                width="0.2"
                height="0.2"
                id="addButton"
                onClick={addCustomer}
              />
            )}
          </styled.Customer>

          {/* ProductList */}
          <styled.ProductList>
            {cartItems.map((item) => {
              return (
                <styled.ListItem key={item.idRorKey}>
                  <styled.ListItemWrapper
                    onClick={() =>
                      setDeleteBtnIsShow({
                        [item.idRorKey]: !deleteBtnIsShow[item.idRorKey]
                      })
                    }
                  >
                    <styled.Image src={item.itemPic} />
                    {/* ItemInfo */}
                    <styled.ItemInfo>
                      <styled.ItemTitle>{item.shortTitle}</styled.ItemTitle>
                      <styled.ItemDesc>
                        {item.itemSize} {item.itemColor}{' '}
                        {item.discountRate && `折扣率 ${item.discountRate}`}
                      </styled.ItemDesc>
                    </styled.ItemInfo>
                    {/* ItemCount */}
                    {/* <styled.ItemCount>2</styled.ItemCount> */}
                    {/* PriceWrapper */}
                    <styled.PriceWrapper>
                      <styled.ItemPrice>
                        {item.itemPrice && `￥${item.itemPrice}`}
                      </styled.ItemPrice>
                      <styled.ItemOriginPrice>
                        {item.originalPrice}
                      </styled.ItemOriginPrice>
                    </styled.PriceWrapper>
                  </styled.ListItemWrapper>

                  {!readonly && deleteBtnIsShow[item.idRorKey] && (
                    <styled.DeleteButton
                      name="icon_delete_white"
                      width="0.2"
                      height="0.2"
                      onClick={deleteProductItem(item.idRorKey)}
                    />
                  )}
                </styled.ListItem>
              );
            })}
          </styled.ProductList>

          {!cartItems.length && (
            <styled.Empty>扫码或从左侧添加商品</styled.Empty>
          )}

          {/* Settlement */}
          <styled.Settlement>
            {/* SettleList */}
            <styled.SettleList>
              {!readonly && (
                <styled.SettleItem primary onClick={handleGiftsShow}>
                  <styled.TextLabel>
                    {giftsIsShow ? '请确认添加完成' : '添加优惠折扣'}
                  </styled.TextLabel>
                  <styled.EnhanceIcon
                    name={giftsIsShow ? 'icon_edit_gray' : 'icon_add_c_gray'}
                    width="0.2"
                    height="0.2"
                  />
                </styled.SettleItem>
              )}
              <styled.SettleItem>
                <styled.TextLabel>总优惠</styled.TextLabel>-{discountAmount}
              </styled.SettleItem>
              <styled.SettleItem>
                <styled.TextLabel>扣除税</styled.TextLabel>
                {taxRate}%
              </styled.SettleItem>
            </styled.SettleList>
            {/* Amount */}
            <styled.Amount>
              <styled.TextLabel>总计</styled.TextLabel>
              {realAmount}
            </styled.Amount>
          </styled.Settlement>
        </styled.Body>
      </styled.SaleBlock>

      <Modal
        isOpen={modalIsOpen}
        style={{ ...commonStyle.modalStyle }}
        onRequestClose={() => {
          setModalIsOpen(false);
        }}
      >
        <styled.CustomerList>
          {!readonly && (
            <styled.Button onClick={addCustomer}>快速新建账单</styled.Button>
          )}

          {customerList.map((item) => {
            return (
              <styled.CustomerItem
                key={item.id}
                onClick={() => {
                  setCustomer(item.id);
                }}
              >
                <styled.Avatar />
                <styled.Desc>
                  <styled.Text>{item.name}</styled.Text>
                  <styled.CustomerInfo>{item.info}</styled.CustomerInfo>
                </styled.Desc>
              </styled.CustomerItem>
            );
          })}
        </styled.CustomerList>
      </Modal>

      <styled.BarcodeInput
        ref={barInputEl}
        value={barcode}
        type="text"
        autoFocus
        onChange={(e) => setBarcode(e.target.value)}
        onKeyUp={handleBarcodeChange}
      />
    </Fragment>
  );
}

export default SaleBlock;
