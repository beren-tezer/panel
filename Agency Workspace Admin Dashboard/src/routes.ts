import { createBrowserRouter } from 'react-router'
import Root from './layouts/Root'
import GenelBakis from './pages/GenelBakis'
import IcerikPlani from './pages/IcerikPlani'
import Gorevler from './pages/Gorevler'
import Markalar from './pages/Markalar'
import Onaylar from './pages/Onaylar'
import Ekip from './pages/Ekip'
import Mesai from './pages/Mesai'
import Reklamlar from './pages/Reklamlar'
import Ayarlar from './pages/Ayarlar'
import Yardim from './pages/Yardim'
import GunlukAjansAkisi from './pages/GunlukAjansAkisi'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: GunlukAjansAkisi },
      { path: 'genel-bakis', Component: GenelBakis },
      { path: 'icerik', Component: IcerikPlani },
      { path: 'gorevler', Component: Gorevler },
      { path: 'markalar', Component: Markalar },
      { path: 'onaylar', Component: Onaylar },
      { path: 'ekip', Component: Ekip },
      { path: 'mesai', Component: Mesai },
      { path: 'reklamlar', Component: Reklamlar },
      { path: 'ayarlar', Component: Ayarlar },
      { path: 'yardim', Component: Yardim },
    ],
  },
])
