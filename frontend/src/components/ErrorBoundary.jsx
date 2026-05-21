import React from 'react';
import ErrorPage from '../pages/ErrorPage';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error, info) {
    console.error(error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage text="Recharge la page ou reconnecte-toi si le problème persiste." detail={this.state.message} />;
    }
    return this.props.children;
  }
}
