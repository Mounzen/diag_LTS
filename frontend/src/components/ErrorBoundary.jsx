import React from 'react';
import ErrorPage from '../pages/ErrorPage';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage text="Recharge la page ou reconnecte-toi si le problème persiste." />;
    }
    return this.props.children;
  }
}
