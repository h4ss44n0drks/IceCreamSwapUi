import {FACTORY_ADDRESS, ROUTER_ADDRESS} from '../common/swap'
import IceChain from '../ice-chain'

export const blast: IceChain = {
  id: 81457,
  name: 'Blast L2',
  features: ['swap', 'bridge'],
  network: 'blast',
  rpcUrls: {
    public: { http: ['https://rpc.blast.io'] },
    default: { http: ['https://rpc.blast.io'] },
  },
  blockExplorers: {
    default: { name: 'Blast L2 Explorer', url: 'https://blastscan.io' },
  },
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  contracts: {
    multicall3: {
      address: '0xf3a3dAf360161B2f10c645EF039C709A3Fd4Ea62',
      blockCreated: 208936,
    },
  },
  blockInterval: 2,
  wrappedNative: {
    address: '0x4300000000000000000000000000000000000004',
    decimals: 18,
    symbol: 'WETH',
    name: 'Wrapped Ether',
  },
  swap: {
    factoryAddress: FACTORY_ADDRESS,
    routerAddress: ROUTER_ADDRESS,
    initCodeHash: "0x9b0297e747ad7631e230f0352322013f59d077acbd23be52a45de6c5593b825a",
  },
}
