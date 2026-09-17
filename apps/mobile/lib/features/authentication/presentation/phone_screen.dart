import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/authentication/domain/phone_validator.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class PhoneScreen extends ConsumerStatefulWidget {
  const PhoneScreen({super.key});

  @override
  ConsumerState<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends ConsumerState<PhoneScreen> {
  final _controller = TextEditingController(text: PhoneValidator.defaultCountryCode);
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    final validation = PhoneValidator.validate(_controller.text);
    if (validation != null) {
      setState(() => _error = validation);
      return;
    }
    final e164 = PhoneValidator.toE164(_controller.text)!;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final challenge = await ref.read(authRepositoryProvider).requestOtp(e164);
      if (!mounted) {
        return;
      }
      context.push('/auth/otp', extra: challenge);
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Phone number')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Enter the mobile number you use in Zimbabwe.',
                style: TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 24),
              CampusTextField(
                label: 'Phone number',
                controller: _controller,
                hint: '+263 77 123 4567',
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                autofillHints: const [AutofillHints.telephoneNumber],
                errorText: _error,
                semanticLabel: 'Phone number, default country code plus 263',
                onChanged: (_) => setState(() => _error = null),
              ),
              const Spacer(),
              CampusButton(
                label: 'Continue',
                busy: _busy,
                onPressed: _continue,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
