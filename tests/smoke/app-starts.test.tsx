import { render } from '@testing-library/react-native'

import HomeScreen from '../../app/index'

jest.mock('expo-router', () => ({
  Stack: () => null,
}))

describe('BrushTales app shell', () => {
  it('renders the BrushTales entry point', async () => {
    const { getByText } = await render(<HomeScreen />)

    expect(getByText('Create a profile')).toBeTruthy()
  })
})
