import 'dart:async';

import 'package:campusos/app/bootstrap/route_resolver.dart';
import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/authentication/data/auth_repository.dart';
import 'package:campusos/features/authentication/domain/phone_validator.dart';
import 'package:campusos/shared/models/account_state.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.challenge});

  final OtpChallenge challenge;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  late OtpChallenge _challenge;
  final _controller = TextEditingController();
  final _focus = FocusNode();
  Timer? _timer;
  int _seconds = 0;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _challenge = widget.challenge;
    _syncCountdown();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _syncCountdown());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _syncCountdown() {
    final remaining = _challenge.resendAvailableAt.difference(DateTime.now()).inSeconds;
    setState(() => _seconds = remaining < 0 ? 0 : remaining);
  }

  Future<void> _verify(String otp) async {
    if (otp.length != 6 || _busy) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final session = await ref.read(authRepositoryProvider).verifyOtp(
            challengeId: _challenge.challengeId,
            otp: otp,
          );
      await ref.read(sessionManagerProvider).saveLogin(
            tokens: session.tokens,
            signedInPerson: session.person,
          );
      ref.read(sessionProvider.notifier).setAuthenticated(session.person);
      if (!mounted) {
        return;
      }
      context.go(
        RouteResolver.forAccountState(AccountState.fromApi(session.accountState)),
      );
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _resend() async {
    if (_seconds > 0) {
      return;
    }
    try {
      final next = await ref.read(authRepositoryProvider).requestOtp(_challenge.phoneE164);
      setState(() {
        _challenge = next;
        _error = null;
      });
      _syncCountdown();
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final code = _controller.text;
    return Scaffold(
      appBar: AppBar(title: const Text('Verification code')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Enter the 6-digit code sent to ${PhoneValidator.mask(_challenge.phoneE164)}.',
                style: const TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 24),
              Stack(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: List.generate(6, (index) {
                      final filled = index < code.length;
                      final selected = index == code.length;
                      return _OtpBox(
                        value: filled ? '•' : '',
                        selected: selected,
                      );
                    }),
                  ),
                  AutofillGroup(
                    child: TextField(
                      controller: _controller,
                      focusNode: _focus,
                      autofocus: true,
                      keyboardType: TextInputType.number,
                      autofillHints: const [AutofillHints.oneTimeCode],
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(6),
                      ],
                      style: const TextStyle(color: Colors.transparent, height: 0.01),
                      cursorColor: Colors.transparent,
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        counterText: '',
                        filled: false,
                      ),
                      onChanged: (value) {
                        setState(() => _error = null);
                        if (value.length == 6) {
                          _verify(value);
                        }
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Semantics(
                label: 'One-time verification code',
                textField: true,
                child: const SizedBox.shrink(),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ),
              const SizedBox(height: 20),
              if (_seconds > 0)
                Text('Resend available in $_seconds s')
              else
                CampusTextButton(
                  label: 'Resend code',
                  semanticLabel: 'Resend verification code',
                  onPressed: _resend,
                ),
              CampusTextButton(
                label: 'Change number',
                onPressed: () => context.go('/auth/phone'),
              ),
              const Spacer(),
              CampusButton(
                label: 'Continue',
                busy: _busy,
                onPressed: code.length == 6 ? () => _verify(code) : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OtpBox extends StatelessWidget {
  const _OtpBox({required this.value, required this.selected});

  final String value;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      width: 48,
      height: 56,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: selected ? const Color(0xFF0F4C3A) : const Color(0xFFD9E0D6),
          width: selected ? 2 : 1,
        ),
      ),
      child: Text(
        value,
        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
      ),
    );
  }
}
