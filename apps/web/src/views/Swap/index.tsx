import { useCallback, useContext, useEffect } from 'react'
import { ChainId, Currency, JSBI, NATIVE } from '@pancakeswap/sdk'
import { Box, Flex, BottomDrawer, useMatchBreakpoints, Swap as SwapUI } from '@pancakeswap/uikit'
import { EXCHANGE_DOCS_URLS } from 'config/constants'
import { AppBody } from 'components/App'

import { useCurrency } from '../../hooks/Tokens'
import { Field } from '../../state/swap/actions'
import { useSwapState, useSingleTokenSwapInfo, useDerivedSwapInfo } from '../../state/swap/hooks'
import Page from '../Page'
import PriceChartContainer from './components/Chart/PriceChartContainer'

import SwapForm from './components/SwapForm'
import StableSwapFormContainer from './StableSwap'
import { StyledInputCurrencyWrapper, StyledSwapContainer } from './styles'
import SwapTab, { SwapType } from './components/SwapTab'
import { SwapFeaturesContext } from './SwapFeaturesContext'
import { useWeb3React } from '@pancakeswap/wagmi'
import { useIsAkkaContractSwapModeActive, useIsAkkaSwap, useIsAkkaSwapModeActive, useIsAkkaSwapModeStatus } from 'state/global/hooks'
import { useActiveChainId } from 'hooks/useActiveChainId'
import useSWR from 'swr'
import { useAkkaSwapInfo } from './AkkaSwap/hooks/useAkkaSwapInfo'
import { useUserSlippageTolerance } from 'state/user/hooks'
import { useAkkaRouterContract } from 'utils/exchange'
import { ApprovalState, useApproveCallbackFromTrade } from 'hooks/useApproveCallback'
import { useApproveCallbackFromAkkaTrade } from './AkkaSwap/hooks/useApproveCallbackFromAkkaTrade'
import useWrapCallback, { WrapType } from 'hooks/useWrapCallback'
import useActiveWeb3React from 'hooks/useActiveWeb3React'

export default function Swap() {
  const { isMobile } = useMatchBreakpoints()
  const { isChartExpanded, isChartDisplayed, setIsChartDisplayed, setIsChartExpanded, isChartSupported } =
    useContext(SwapFeaturesContext)

  const { account } = useWeb3React()

  // swap state & price data
  const {
    independentField,
    typedValue,
    recipient,
    [Field.INPUT]: { currencyId: inputCurrencyId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId },
  } = useSwapState()

  const inputCurrency = useCurrency(inputCurrencyId)
  const outputCurrency = useCurrency(outputCurrencyId)
  const currencies: { [field in Field]?: Currency } = {
    [Field.INPUT]: inputCurrency ?? undefined,
    [Field.OUTPUT]: outputCurrency ?? undefined,
  }

  const { chainId: walletChainId } = useWeb3React()
  const { chainId: appChainId } = useActiveChainId()

  // isAkkaSwapMode checks if this is akka router form or not from redux
  const [isAkkaSwapMode, toggleSetAkkaMode, toggleSetAkkaModeToFalse, toggleSetAkkaModeToTrue] =
    useIsAkkaSwapModeStatus()

  // get custom setting values for user
  const [allowedSlippage] = useUserSlippageTolerance()

  // Take swap information from pancakeswap router
  const {
    v2Trade,
    currencyBalances,
    parsedAmount,
    inputError: swapInputError,
  } = useDerivedSwapInfo(independentField, typedValue, inputCurrency, outputCurrency, recipient)

  // Take swap information from AKKA router
  const {
    trade: akkaRouterTrade,
    currencyBalances: akkaCurrencyBalances,
    parsedAmount: akkaParsedAmount,
    inputError: akkaSwapInputError,
  } = useAkkaSwapInfo(independentField, typedValue, inputCurrency, outputCurrency, allowedSlippage)
  const {
    wrapType,
    execute: onWrap,
    inputError: wrapInputError,
  } = useWrapCallback(currencies[Field.INPUT], currencies[Field.OUTPUT], typedValue)
  const showWrap: boolean = wrapType !== WrapType.NOT_APPLICABLE
  const trade = showWrap ? undefined : v2Trade
  const parsedAmounts = showWrap
    ? {
      [Field.INPUT]: parsedAmount,
      [Field.OUTPUT]: parsedAmount,
    }
    : {
      [Field.INPUT]: independentField === Field.INPUT ? parsedAmount : trade?.inputAmount,
      [Field.OUTPUT]: independentField === Field.OUTPUT ? parsedAmount : trade?.outputAmount,
    }
  const akkaContract = useAkkaRouterContract()
  const { isConnected } = useWeb3React()
  const methodName = 'multiPathSwap'
  const [akkaApproval, akkaApproveCallback] = useApproveCallbackFromAkkaTrade(parsedAmounts[Field.INPUT])

  // isAkkaSwapActive checks if akka router is generally active or not
  const [isAkkaSwapActive, toggleSetAkkaActive, toggleSetAkkaActiveToFalse, toggleSetAkkaActiveToTrue] =
    useIsAkkaSwapModeActive()

  // isAkkaContractSwapMode checks if this is akka router form or not from redux
  const [isAkkaContractSwapMode, toggleSetAkkaContractMode, toggleSetAkkaContractModeToFalse, toggleSetAkkaContractModeToTrue] =
    useIsAkkaContractSwapModeActive()

  const { chainId } = useActiveWeb3React()
  // Check if pancakeswap route is better than akka route or not
  useEffect(() => {
    if (akkaRouterTrade?.route?.returnAmountWei && v2Trade?.outputAmount) {
      if (v2Trade?.outputAmount.greaterThan(JSBI.BigInt(akkaRouterTrade?.route?.returnAmountWei))) {
        toggleSetAkkaModeToFalse()
      } else {
        toggleSetAkkaModeToTrue()
      }
    }
  }, [typedValue, akkaRouterTrade, inputCurrencyId, outputCurrencyId])
  useEffect(() => {
    if (isConnected) {
      if (akkaApproval === ApprovalState.APPROVED) {
        if (
          currencyBalances[Field.INPUT] &&
          parsedAmount &&
          currencyBalances[Field.INPUT].greaterThan(parsedAmount)
        ) {
          akkaContract.estimateGas[methodName](
            akkaRouterTrade?.args?.amountIn,
            akkaRouterTrade?.args?.amountOutMin,
            akkaRouterTrade?.args?.data,
            [],
            [],
            account
            , {
              value: inputCurrencyId === NATIVE[chainId].symbol ? akkaRouterTrade?.args?.amountIn : '0',
            })
            .then((data) => {
              if (data.gt("21000")) {
                toggleSetAkkaContractModeToTrue()
              }
              else {
                toggleSetAkkaContractModeToFalse()
              }

            })
            .catch(() => {
              toggleSetAkkaContractModeToFalse()
            })
        }
        else {
          toggleSetAkkaContractModeToTrue()
        }
      }
      else {
        toggleSetAkkaContractModeToTrue()
      }
    }
    else {
      toggleSetAkkaContractModeToTrue()
    }
  }, [akkaApproval, isConnected, parsedAmounts, parsedAmount, akkaRouterTrade])


  // Check api bridge data is empty
  useEffect(() => {
    if (akkaRouterTrade?.args?.bridge?.length !== 0) {
      toggleSetAkkaModeToFalse()
    }
  }, [akkaRouterTrade])

  const singleTokenPrice = useSingleTokenSwapInfo(inputCurrencyId, inputCurrency, outputCurrencyId, outputCurrency)

  return (
    <Page removePadding={isChartExpanded} hideFooterOnDesktop={isChartExpanded}>
      <Flex marginBottom="4em" width={['328px', , '100%']} height="100%" justifyContent="center" position="relative">
        {!isMobile && isChartSupported && (
          <PriceChartContainer
            inputCurrencyId={inputCurrencyId}
            inputCurrency={currencies[Field.INPUT]}
            outputCurrencyId={outputCurrencyId}
            outputCurrency={currencies[Field.OUTPUT]}
            isChartExpanded={isChartExpanded}
            setIsChartExpanded={setIsChartExpanded}
            isChartDisplayed={isChartDisplayed}
            currentSwapPrice={singleTokenPrice}
          />
        )}
        {isChartSupported && (
          <BottomDrawer
            content={
              <PriceChartContainer
                inputCurrencyId={inputCurrencyId}
                inputCurrency={currencies[Field.INPUT]}
                outputCurrencyId={outputCurrencyId}
                outputCurrency={currencies[Field.OUTPUT]}
                isChartExpanded={isChartExpanded}
                setIsChartExpanded={setIsChartExpanded}
                isChartDisplayed={isChartDisplayed}
                currentSwapPrice={singleTokenPrice}
                isMobile
              />
            }
            isOpen={isChartDisplayed}
            setIsOpen={setIsChartDisplayed}
          />
        )}
        <Flex flexDirection="column">
          <StyledSwapContainer $isChartExpanded={isChartExpanded}>
            <StyledInputCurrencyWrapper mt={isChartExpanded ? '24px' : '0'}>
              <AppBody>
                <SwapTab>
                  {(swapTypeState) =>
                    swapTypeState === SwapType.STABLE_SWAP ? <StableSwapFormContainer /> : <SwapForm />
                  }
                </SwapTab>
              </AppBody>
            </StyledInputCurrencyWrapper>
          </StyledSwapContainer>
          {isChartExpanded && (
            <Box display={['none', null, null, 'block']} width="100%" height="100%">
              <SwapUI.Footer variant="side" helpUrl={EXCHANGE_DOCS_URLS} />
            </Box>
          )}
        </Flex>
      </Flex>
    </Page>
  )
}
