import { render } from '@testing-library/react-native'

import RootLayout from '../../app/_layout'

jest.mock('expo-router', () => ({
  Stack: () => null,
}))

describe('BrushTales app shell', () => {
  it('renders the BrushTales entry point', async () => {
    const { getByText } = await render(<RootLayout />)

    expect(getByText('BrushTales')).toBeTruthy()
  })
})
